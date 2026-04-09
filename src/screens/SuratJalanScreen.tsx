import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Printer, Eye, Send, CheckCircle, Shield } from 'lucide-react';
import { Button } from '../components/Button';
import { fetchApiData } from '../data/api';
import type { ApiRow } from '../data/api';
import { useStore } from '../store/useStore';
import { ApprovalModal } from '../components/ApprovalModal';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

const COMPANY_LOGO = 'https://i.ibb.co.com/xSTT9wJK/download.png';
const COMPANY_NAME = 'PT Energi Batubara Lestari';
const COMPANY_UNIT = 'Unit Nursery';
const COMPANY_ADDRESS = 'Kalimantan Selatan';

function generateNomorSurat(row: ApiRow, index: number): string {
  const d = new Date(row.tanggal);
  const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const bulan = bulanRomawi[d.getMonth()] || 'I';
  const tahun = d.getFullYear();
  const nomor = String(index + 1).padStart(4, '0');
  return `SJ-BIBIT/${nomor}/${bulan}/${tahun}`;
}

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function SuratJalanScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);

  const rowIndex = Number(searchParams.get('row') || '0');
  const isFormPreview = searchParams.get('preview') === '1';

  const [row, setRow] = useState<ApiRow | null>(null);
  const [allRows, setAllRows] = useState<ApiRow[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [kodeVerifikasi, setKodeVerifikasi] = useState<string>('');
  const [showAdminModal, setShowAdminModal] = useState(false);

  const { approvals, approveSuratJalan } = useStore();

  const getApprovalStatus = useCallback(() => {
    if (!row) return null;
    const nomorSurat = generateNomorSurat(row, rowIndex);
    return approvals.find((a) => a.nomorSurat === nomorSurat);
  }, [row, rowIndex, approvals]);

  // Load data
  useEffect(() => {
    fetchApiData().then((rows) => {
      setAllRows(rows);

      // Jika preview dari form input — buat row virtual dari query params
      if (isFormPreview) {
        const formRow: ApiRow = {
          tanggal: searchParams.get('tanggal') || new Date().toISOString().split('T')[0],
          bulan: '',
          bibit: searchParams.get('bibit') || '-',
          masuk: 0,
          keluar: Number(searchParams.get('keluar')) || 0,
          mati: 0,
          total: 0,
          sumber: searchParams.get('sumber') || '-',
          tujuan: searchParams.get('tujuan') || '-',
          statusKirim: '',
          kodeVerifikasi: 'PREVIEW',
          dibuatOleh: searchParams.get('dibuatOleh') || '-',
          driver: searchParams.get('driver') || '-',
        };
        setRow(formRow);
        setKodeVerifikasi('PREVIEW');
        return;
      }

      // Normal mode: ambil dari data distribusi
      const distribusi = rows.filter((r) => r.keluar > 0);
      const selected = distribusi[rowIndex] || distribusi[distribusi.length - 1];
      if (selected) {
        setRow(selected);
        setKodeVerifikasi(selected.kodeVerifikasi || '');
      }
    });
  }, [rowIndex, isFormPreview, searchParams]);

  // Generate QR code with verification code
  useEffect(() => {
    if (!row || !kodeVerifikasi) return;
    // QR berisi kode verifikasi saja — hanya bisa diverifikasi lewat scanner di aplikasi
    const qrContent = `VERIFY:${kodeVerifikasi}`;
    QRCode.toDataURL(qrContent, {
      width: 140,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [row, kodeVerifikasi]);

  // Load logo as data URL for PDF
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      }
    };
    img.src = COMPANY_LOGO;
  }, []);

  // Hitung stok per bibit
  const getStokBibit = useCallback(
    (bibit: string) => {
      let stok = 0;
      for (const r of allRows) {
        if (r.bibit.trim().toUpperCase() === bibit.trim().toUpperCase()) {
          stok += r.masuk - r.keluar - r.mati;
        }
      }
      return Math.max(0, stok);
    },
    [allRows],
  );

  if (!row) {
    return (
      <div className="fade-in flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500">Memuat data surat jalan...</p>
      </div>
    );
  }

  const nomorSurat = generateNomorSurat(row, rowIndex);
  const stokSetelah = getStokBibit(row.bibit);
  const approval = getApprovalStatus();
  const isApproved = approval?.status === 'approved';

  // === PDF Generation (shared: draft or final) ===
  const generatePDF = async (draft: boolean) => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = pageW - margin * 2;
      let y = 16;

      // Header with logo
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, y, 14, 14);
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(COMPANY_NAME, margin + 18, y + 5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${COMPANY_UNIT} — ${COMPANY_ADDRESS}`, margin + 18, y + 11);

      y += 20;

      // Line separator
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.8);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SURAT JALAN DISTRIBUSI BIBIT', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`No: ${nomorSurat}`, pageW / 2, y, { align: 'center' });
      y += 12;

      // Info section
      const infoLeft = margin;
      const infoValX = margin + 40;
      doc.setFontSize(10);

      const infoRows = [
        ['Tanggal', formatTanggal(row.tanggal)],
        ['Jenis Bibit', row.bibit],
        ['Jumlah', `${row.keluar.toLocaleString('id-ID')} polybag`],
        ['Asal / Sumber', row.sumber || '-'],
        ['Tujuan / Lokasi', row.tujuan || '-'],
      ];

      for (const [label, value] of infoRows) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}`, infoLeft, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${value}`, infoValX, y);
        y += 6;
      }

      y += 6;

      // Table
      const colWidths = [12, contentW * 0.35, contentW * 0.2, contentW * 0.18, contentW * 0.27 - 12];
      const colX = [margin];
      for (let i = 1; i < colWidths.length; i++) {
        colX.push(colX[i - 1] + colWidths[i - 1]);
      }
      const rowH = 8;

      // Table header
      doc.setFillColor(16, 185, 129);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, y, contentW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const headers = ['No', 'Jenis Bibit', 'Jumlah', 'Satuan', 'Keterangan'];
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], colX[i] + 2, y + 5.5);
      }
      y += rowH;

      // Table row
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, contentW, rowH);
      const tableData = ['1', row.bibit, row.keluar.toLocaleString('id-ID'), 'polybag', `Stok sisa: ${stokSetelah.toLocaleString('id-ID')}`];
      for (let i = 0; i < tableData.length; i++) {
        doc.text(tableData[i], colX[i] + 2, y + 5.5);
      }
      y += rowH;

      // Bottom line of table
      doc.line(margin, y, margin + contentW, y);
      y += 12;

      // Catatan
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('Catatan: Pastikan bibit dalam kondisi baik saat penyerahan. Surat jalan ini sebagai bukti distribusi resmi.', margin, y, {
        maxWidth: contentW,
      });
      y += 14;

      // Signature section
      const sigW = contentW / 3;
      const sigLabels = ['Dibuat oleh', 'PJ Nursery', 'Driver'];
      const sigNames = [row.dibuatOleh || '-', '', row.driver || '-'];
      const sigRoles = ['Petugas Nursery', 'Penanggung Jawab', 'Sopir / Kurir'];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      for (let i = 0; i < 3; i++) {
        const cx = margin + sigW * i + sigW / 2;
        doc.text(sigLabels[i], cx, y, { align: 'center' });
      }
      y += 24;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      for (let i = 0; i < 3; i++) {
        const cx = margin + sigW * i + sigW / 2;
        doc.line(cx - 18, y, cx + 18, y);
        if (sigNames[i] && sigNames[i] !== '-') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(sigNames[i], cx, y + 4, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.text(sigRoles[i], cx, y + 8, { align: 'center' });
        } else {
          doc.text(sigRoles[i], cx, y + 5, { align: 'center' });
        }
      }
      y += 16;

      // QR code and footer
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', margin, y, 28, 28);
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Scan QR Code untuk verifikasi', margin + 32, y + 6);
      doc.text('keaslian dokumen via aplikasi Smart Nursery.', margin + 32, y + 11);
      if (kodeVerifikasi && kodeVerifikasi !== 'PREVIEW') {
        doc.setFontSize(7);
        doc.setFont('courier', 'normal');
        doc.text('Kode: ' + kodeVerifikasi, margin + 32, y + 16);
      }
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dicetak otomatis oleh Montana AI Engine`, margin + 32, y + 21);
      doc.text(`${COMPANY_NAME} — ${COMPANY_UNIT}`, margin + 32, y + 26);

      // === DRAFT WATERMARK ===
      if (draft) {
        doc.saveGraphicsState();
        const gState = (doc as any).GState({ opacity: 0.08 });
        doc.setGState(gState);
        doc.setFontSize(120);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        const centerX = pageW / 2;
        const centerY = pageH / 2;
        doc.text('DRAFT', centerX, centerY, {
          align: 'center',
          angle: 45,
        });
        doc.restoreGraphicsState();
      }

      // === APPROVAL SIGNATURE ===
      if (isApproved && approval) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text('✓ DISAHKAN', pageW - margin, y - 8, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(`Disetujui oleh: ${approval.approvedBy}`, pageW - margin, y - 2, { align: 'right' });
        doc.text(`Tanggal: ${new Date(approval.approvedAt!).toLocaleDateString('id-ID')}`, pageW - margin, y + 3, { align: 'right' });
      }

      const prefix = draft ? 'DRAFT-' : '';
      doc.save(`${prefix}Surat-Jalan-${nomorSurat.replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleReviewDraft = () => generatePDF(true);
  const handleDownloadFinal = () => {
    setIsDraft(false);
    generatePDF(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Surat Jalan ${nomorSurat}`,
          text: `Surat Jalan Distribusi Bibit\nNo: ${nomorSurat}\nJenis: ${row.bibit}\nJumlah: ${row.keluar} polybag\nTujuan: ${row.tujuan}`,
        });
      } catch {
        // user cancelled
      }
    }
  };

  return (
    <div className="fade-in space-y-4 pb-24">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Surat Jalan</h1>
          <p className="text-xs text-gray-500">{nomorSurat}</p>
        </div>
      </div>

      {/* Preview Card — Surat Jalan */}
      <div ref={previewRef} className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden relative">
        {/* DRAFT Watermark Overlay */}
        {isDraft && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span
              className="text-[72px] font-black text-red-500/10 select-none tracking-[0.2em]"
              style={{ transform: 'rotate(-35deg)' }}
            >
              DRAFT
            </span>
          </div>
        )}
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 flex items-center gap-3">
          <img
            src={COMPANY_LOGO}
            alt="Logo"
            className="w-10 h-10 rounded-xl bg-white/20 p-1 object-contain"
          />
          <div className="text-white">
            <p className="font-bold text-sm leading-tight">{COMPANY_NAME}</p>
            <p className="text-[11px] text-emerald-100">
              {COMPANY_UNIT} — {COMPANY_ADDRESS}
            </p>
          </div>
        </div>

        {/* Emerald divider */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

        {/* Document body */}
        <div className="px-5 py-5 space-y-5">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900 tracking-wide">
              SURAT JALAN DISTRIBUSI BIBIT
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">No: {nomorSurat}</p>
          </div>

          {/* Info Grid */}
          <div className="space-y-2.5">
            <InfoRow label="Tanggal" value={formatTanggal(row.tanggal)} />
            <InfoRow label="Jenis Bibit" value={row.bibit} highlight />
            <InfoRow label="Jumlah" value={`${row.keluar.toLocaleString('id-ID')} polybag`} highlight />
            <InfoRow label="Asal / Sumber" value={row.sumber || '-'} />
            <InfoRow label="Tujuan / Lokasi" value={row.tujuan || '-'} />
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-emerald-600 text-white">
                  <th className="py-2 px-2 text-left font-semibold w-8">No</th>
                  <th className="py-2 px-2 text-left font-semibold">Jenis Bibit</th>
                  <th className="py-2 px-2 text-right font-semibold">Jumlah</th>
                  <th className="py-2 px-2 text-left font-semibold">Satuan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="py-2.5 px-2 text-gray-600">1</td>
                  <td className="py-2.5 px-2 font-medium text-gray-900">{row.bibit}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                    {row.keluar.toLocaleString('id-ID')}
                  </td>
                  <td className="py-2.5 px-2 text-gray-600">polybag</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Stock info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-xs text-blue-700">
              📦 Sisa stok <strong>{row.bibit}</strong> setelah distribusi:{' '}
              <strong>{stokSetelah.toLocaleString('id-ID')}</strong> polybag
            </span>
          </div>

          {/* Signature section */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { label: 'Dibuat oleh', name: row.dibuatOleh || '', role: 'Petugas Nursery' },
              { label: 'PJ Nursery', name: '', role: 'Penanggung Jawab' },
              { label: 'Driver', name: row.driver || '', role: 'Sopir / Kurir' },
            ].map((sig) => (
              <div key={sig.label} className="text-center space-y-8">
                <p className="text-[10px] font-semibold text-gray-700">{sig.label}</p>
                <div className="border-b border-gray-400 mx-2" />
                {sig.name && sig.name !== '-' ? (
                  <>
                    <p className="text-[10px] font-bold text-gray-800 -mt-6">{sig.name}</p>
                    <p className="text-[9px] text-gray-400 -mt-7">{sig.role}</p>
                  </>
                ) : (
                  <p className="text-[9px] text-gray-400 -mt-6">{sig.role}</p>
                )}
              </div>
            ))}
          </div>

          {/* QR Code + Footer */}
          <div className="border-t border-gray-200 pt-4 flex items-start gap-3">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Verification" className="w-20 h-20 rounded-lg border border-gray-200" />
            )}
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-semibold text-gray-700">Scan QR Code untuk verifikasi</p>
              <p className="text-[9px] text-gray-400">
                Verifikasi keaslian dokumen ini melalui fitur Scanner di aplikasi Smart Nursery.
              </p>
              {kodeVerifikasi && kodeVerifikasi !== 'PREVIEW' && (
                <p className="text-[9px] font-mono text-gray-400 mt-0.5">
                  Kode: {kodeVerifikasi}
                </p>
              )}
              <div className="pt-1.5">
                <p className="text-[8px] text-gray-300">
                  Dicetak otomatis oleh Montana AI Engine
                </p>
                <p className="text-[8px] text-gray-300">
                  {COMPANY_NAME} — {COMPANY_UNIT}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Draft badge */}
      {isDraft && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">Mode Draft — Review sebelum kirim</span>
        </div>
      )}

      {/* Approval Status */}
      {isApproved && approval && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-300">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-800">
            Approved by {approval.approvedBy} — {new Date(approval.approvedAt!).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* Admin/Approval button for non-approved docs */}
      {!isApproved && isDraft && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <Shield className="w-4 h-4 text-gray-600" />
          <button
            onClick={() => setShowAdminModal(true)}
            className="text-sm font-semibold text-gray-700 hover:text-emerald-600 transition-colors"
          >
            Approve Dokumen
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[420px] p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100">
        {isDraft ? (
          <div className="flex gap-2">
            <Button
              size="md"
              variant="secondary"
              icon={<Eye className="w-4 h-4" />}
              onClick={handleReviewDraft}
              loading={generating}
              className="flex-1"
            >
              Review Draft
            </Button>
            <Button
              size="md"
              variant="primary"
              icon={<Send className="w-4 h-4" />}
              onClick={handleDownloadFinal}
              loading={generating}
              className="flex-1"
            >
              Kirim Final
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 mb-2">
              <span className="text-xs font-semibold text-emerald-700">✅ Dokumen Final — Siap Distribusi</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="md"
                variant="primary"
                icon={<Download className="w-4 h-4" />}
                onClick={() => generatePDF(false)}
                loading={generating}
                className="flex-1"
              >
                Download PDF
              </Button>
              <Button
                size="md"
                variant="secondary"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
                className="w-12 !px-0"
              />
              {typeof navigator.share === 'function' && (
                <Button
                  size="md"
                  variant="secondary"
                  icon={<Share2 className="w-4 h-4" />}
                  onClick={handleShare}
                  className="w-12 !px-0"
                />
              )}
            </div>
          </div>
        )}

      </div>
      <ApprovalModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={() => {
          if (row) {
            approveSuratJalan(nomorSurat, 'Admin');
          }
        }}
      />
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-400">:</span>
      <span className={`${highlight ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

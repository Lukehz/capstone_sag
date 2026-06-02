// Exportaciones del Dashboard:
//  - PDF: "fotografía" del panel operativo (excluye Administrador y Accesos).
//  - Excel: registros de parcelas y cuarentenas (los que el rol puede ver).
// Las librerías pesadas se cargan solo cuando el usuario pulsa exportar.
(function () {
  const URL_XLSX  = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const URL_H2C   = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const URL_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-rsrc="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.dataset.rsrc = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
      document.head.appendChild(s);
    });
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
      btn.dataset.txt = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando…';
    } else if (btn.dataset.txt) {
      btn.innerHTML = btn.dataset.txt;
    }
  }

  function aviso(msg) { (window.notify ? window.notify(msg) : alert(msg)); }

  // ---- Excel: registros de parcelas y cuarentenas ----
  async function exportarExcel(btn) {
    try {
      setBusy(btn, true);
      const resp = await fetch('/reportes/datos');
      if (!resp.ok) throw new Error('Error ' + resp.status);
      const data = await resp.json();

      await cargarScript(URL_XLSX);
      const wb = XLSX.utils.book_new();
      if (Array.isArray(data.parcelas) && data.parcelas.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.parcelas), 'Parcelas');
      }
      if (Array.isArray(data.cuarentenas) && data.cuarentenas.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.cuarentenas), 'Cuarentenas');
      }
      if (!wb.SheetNames.length) { aviso('No hay registros para exportar.'); return; }

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `registros_landmosaic_${fecha}.xlsx`);
    } catch (e) {
      aviso('No se pudo exportar a Excel: ' + e.message);
    } finally {
      setBusy(btn, false);
    }
  }

  // ---- PDF: foto del panel operativo (sin Administrador ni Accesos) ----
  async function exportarPDF(btn) {
    try {
      setBusy(btn, true);
      await cargarScript(URL_H2C);
      await cargarScript(URL_JSPDF);

      const cont = document.querySelector('.dash-wrap') || document.querySelector('.dash');
      if (!cont) throw new Error('No se encontró el panel.');

      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
      const canvas = await html2canvas(cont, {
        scale: 2,
        backgroundColor: bg,
        useCORS: true,
        // Excluir secciones con datos de usuarios/accesos y los propios botones
        ignoreElements: (el) =>
          el.id === 'dash-admin' || el.id === 'dash-accesos' || el.classList.contains('reportes-actions')
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgW = pw;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL('image/png');

      let heightLeft = imgH;
      let pos = 0;
      pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        pos -= ph;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
        heightLeft -= ph;
      }

      const fecha = new Date().toISOString().slice(0, 10);
      pdf.save(`dashboard_landmosaic_${fecha}.pdf`);
    } catch (e) {
      aviso('No se pudo exportar a PDF: ' + e.message);
    } finally {
      setBusy(btn, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bExcel = document.getElementById('btn-export-excel');
    const bPdf = document.getElementById('btn-export-pdf');
    if (bExcel) bExcel.addEventListener('click', () => exportarExcel(bExcel));
    if (bPdf) bPdf.addEventListener('click', () => exportarPDF(bPdf));
  });
})();

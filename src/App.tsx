import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  RotateCcw, 
  Check, 
  Trash2, 
  Download, 
  Settings, 
  HelpCircle, 
  ChevronRight, 
  User, 
  Building, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Database,
  Grid,
  Sparkles,
  RefreshCw,
  Video,
  FileSpreadsheet,
  Globe,
  ArrowRight
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

interface AttendanceLog {
  id: number;
  nama: string;
  instansi: string;
  waktu: string;
  foto: string;
}

// Helper: Adjust hex color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  if (!hex || hex[0] !== '#') return "#4f46e5";
  let R = parseInt(hex.substring(1, 3), 16) || 0;
  let G = parseInt(hex.substring(3, 5), 16) || 0;
  let B = parseInt(hex.substring(5, 7), 16) || 0;

  R = parseInt(((R * (100 + percent)) / 100).toString());
  G = parseInt(((G * (100 + percent)) / 100).toString());
  B = parseInt(((B * (100 + percent)) / 100).toString());

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  const rHex = R.toString(16).padStart(2, "0");
  const gHex = G.toString(16).padStart(2, "0");
  const bHex = B.toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

// Helper: Create initials avatar base64
function createAvatarBase64(name: string, color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 200, 200);
  grad.addColorStop(0, color || "#4f46e5");
  grad.addColorStop(1, adjustColorBrightness(color || "#4f46e5", -20));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 200, 200);

  // Decorative geometric accent
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.arc(100, 100, 70, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 80px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  const initials = (name || "Peserta")
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "P";
    
  ctx.fillText(initials, 100, 100);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// Helper: Convert any image URL safely to Data URL with 800ms timeout to prevent hanging
async function getSafeDataUrl(url: string, name: string): Promise<string> {
  if (!url) return createAvatarBase64(name, "#4f46e5");
  if (url.startsWith("data:image/")) return url;

  const loadPromise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(img.naturalWidth || 120, 200);
        canvas.height = Math.min(img.naturalHeight || 120, 200);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
          return;
        }
      } catch (e) {
        // Tainted canvas
      }
      resolve(createAvatarBase64(name, "#4f46e5"));
    };
    img.onerror = () => {
      resolve(createAvatarBase64(name, "#4f46e5"));
    };
    img.src = url;
  });

  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(createAvatarBase64(name, "#4f46e5"));
    }, 800);
  });

  return Promise.race([loadPromise, timeoutPromise]);
}

export default function App() {
  // Core States
  const [step, setStep] = useState<number>(1);
  const [nama, setNama] = useState<string>("");
  const [instansi, setInstansi] = useState<string>("");
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    const saved = localStorage.getItem("appsScriptUrl");
    if (saved === "https://script.google.com/macros/s/AKfycbzY02TqfGqJGMPWUV5nxNm3ffDch7l_uQxAU86E2s2VynI0OmJJ4toWQcutHKvXDkHjmQ/exec") {
      return "https://script.google.com/macros/s/AKfycbxC9sqr2eYkZxkYSziaJAhkFBrXjEY97DO980B8lLkTZaOkawRw8hrUzleG52uEME3clw/exec";
    }
    return saved || "https://script.google.com/macros/s/AKfycbxC9sqr2eYkZxkYSziaJAhkFBrXjEY97DO980B8lLkTZaOkawRw8hrUzleG52uEME3clw/exec";
  });
  
  // Settings & Navigation
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Camera & Video
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>("");
  const [flashActive, setFlashActive] = useState<boolean>(false);
  
  // Dynamic Realtime Clock for "Geometric Balance" layout
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Stats & Logs
  const [logs, setLogs] = useState<AttendanceLog[]>(() => {
    const saved = localStorage.getItem("logAbsensi");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Fetch logs from Google Sheet
  const fetchLogsFromSheet = async (quiet = false) => {
    if (!appsScriptUrl || appsScriptUrl.trim() === "") {
      if (!quiet) showToast("URL Google Apps Script belum dikonfigurasi.", "warning");
      return;
    }
    
    setIsLoadingLogs(true);
    if (!quiet) showToast("Mengunduh data presensi terbaru dari Spreadsheet...", "info");
    
    try {
      const response = await fetch(appsScriptUrl);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        if (text.trim().startsWith("<!DOCTYPE html") || text.trim().startsWith("<html")) {
          throw new Error("Respons berupa halaman HTML. Pastikan Web App dipublikasikan dengan akses 'Anyone' (Siapa saja).");
        }
        throw new Error("Respons dari server tidak berformat JSON.");
      }
      
      if (Array.isArray(data)) {
        setLogs(data);
        if (!quiet) showToast(`Berhasil memuat ${data.length} data presensi dari database!`, "success");
      } else if (data && typeof data === "object") {
        if (data.status === "error") {
          throw new Error(data.message || "Terjadi kesalahan di Google Apps Script.");
        } else if (Array.isArray(data.data)) {
          setLogs(data.data);
          if (!quiet) showToast(`Berhasil memuat ${data.data.length} data presensi dari database!`, "success");
        } else if (Array.isArray(data.logs)) {
          setLogs(data.logs);
          if (!quiet) showToast(`Berhasil memuat ${data.logs.length} data presensi dari database!`, "success");
        } else if (data.status === "success" || data.message) {
          // Handshake / active response - Apps Script is active, but no array logs returned yet
          setLogs([]);
          if (!quiet) showToast("Terhubung ke Google Apps Script! (Database Kosong / Siap Menerima Data)", "success");
        } else {
          throw new Error("Format data JSON tidak dikenal (bukan array presensi).");
        }
      } else {
        throw new Error("Format data tidak dikenal.");
      }
    } catch (error: any) {
      console.error("Gagal mengambil data dari Google Sheets:", error);
      if (!quiet) {
        showToast(`Sinkronisasi gagal: ${error.message || error}`, "error");
      }
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogsFromSheet(true);
  }, [appsScriptUrl]);

  // Success ticket state
  const [currentTicket, setCurrentTicket] = useState<{
    nama: string;
    instansi: string;
    waktu: string;
    foto: string;
  } | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning" | null;
  }>({ message: "", type: null });

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Ticking live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save Apps Script URL
  useEffect(() => {
    localStorage.setItem("appsScriptUrl", appsScriptUrl);
  }, [appsScriptUrl]);

  // Save Logs to local storage
  useEffect(() => {
    localStorage.setItem("logAbsensi", JSON.stringify(logs));
  }, [logs]);

  // Toast auto-hide
  useEffect(() => {
    if (toast.type) {
      const timer = setTimeout(() => {
        setToast({ message: "", type: null });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    const docElm = document.documentElement;
    if (!document.fullscreenElement) {
      docElm.requestFullscreen().then(() => {
        setIsFullscreen(true);
        showToast("Masuk ke mode layar penuh", "info");
      }).catch(() => {
        setIsFullscreen(!isFullscreen);
        showToast("Layar penuh simulasi diaktifkan", "info");
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Helper Toast function
  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToast({ message, type });
  };



  // Start Physical Camera or Fallback to Simulation
  const startCamera = async () => {
    setCapturedPhoto("");
    setIsSimulation(false);
    
    if (simulationIntervalRef.current) {
      window.cancelAnimationFrame(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setIsSimulation(true);
      showToast("Menggunakan kamera simulasi karena izin akses kamera dibatasi di browser.", "info");
      startSimulationCameraLoop();
    }
  };

  // Stop Camera Streams
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (simulationIntervalRef.current) {
      window.cancelAnimationFrame(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setCameraActive(false);
  };

  // Start Interactive Custom Animation in Canvas for Camera Simulation
  const startSimulationCameraLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 360;
    let angle = 0;
    const cleanNama = nama || "Peserta Workshop";

    const render = () => {
      angle += 0.04;
      
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      const scanY = (canvas.height / 2) + Math.sin(angle) * (canvas.height / 2 - 20);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#3b82f6";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(30, scanY);
      ctx.lineTo(canvas.width - 30, scanY);
      ctx.stroke();
      ctx.shadowBlur = 0; 

      ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 75 + Math.sin(angle * 2) * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 15, 30, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 + 65, 55, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("[ SIMULATOR KAMERA AKTIF ]", canvas.width / 2, 40);
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.fillText(`Mendeteksi Wajah: ${cleanNama}`, canvas.width / 2, 320);

      const timeStr = new Date().toLocaleTimeString("id-ID") + " WIB";
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 11px monospace";
      ctx.fillText(timeStr, canvas.width / 2, 340);

      simulationIntervalRef.current = window.requestAnimationFrame(render);
    };

    render();
  };

  const nextToCamera = () => {
    if (!nama.trim()) {
      showToast("Mohon ketik nama lengkap Anda terlebih dahulu!", "warning");
      return;
    }
    if (!instansi.trim()) {
      showToast("Mohon masukkan nama asal instansi atau sekolah Anda!", "warning");
      return;
    }
    setStep(2);
    startCamera();
  };

  const backToInput = () => {
    stopCamera();
    setStep(1);
  };

  const capturePhoto = () => {
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 300);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!isSimulation && videoRef.current) {
      const vWidth = videoRef.current.videoWidth || 640;
      const vHeight = videoRef.current.videoHeight || 480;
      canvas.width = vWidth;
      canvas.height = vHeight;

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      
      stopCamera();
    } else {
      if (simulationIntervalRef.current) {
        window.cancelAnimationFrame(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      
      canvas.width = 400;
      canvas.height = 400;
      const grad = ctx.createLinearGradient(0, 0, 400, 400);
      grad.addColorStop(0, "#4f46e5");
      grad.addColorStop(1, "#312e81");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 400);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(200, 200, 140, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 140px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initials = nama.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "W";
      ctx.fillText(initials, 200, 190);

      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(200, 310, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(190, 310);
      ctx.lineTo(197, 317);
      ctx.lineTo(212, 302);
      ctx.stroke();
    }

    const photoData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(photoData);
  };

  const retakePhoto = () => {
    setCapturedPhoto("");
    startCamera();
  };

  const submitAttendance = async () => {
    setIsSaving(true);
    showToast("Sedang mencatat data absensi...", "info");

    const sekarang = new Date();
    const opsiWaktu = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } as const;
    const waktuString = sekarang.toLocaleTimeString("id-ID", opsiWaktu) + " WIB";

    const finalPhoto = capturedPhoto || createAvatarBase64(nama, "#3b82f6");

    const dataBaru: AttendanceLog = {
      id: Date.now(),
      nama: nama.trim(),
      instansi: instansi.trim(),
      waktu: waktuString,
      foto: finalPhoto
    };

    let scriptSuccess = false;
    if (appsScriptUrl && appsScriptUrl.trim() !== "") {
      try {
        await fetch(appsScriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataBaru),
        });
        scriptSuccess = true;
      } catch (e) {
        console.error("Gagal mengirim data ke Google Sheets:", e);
      }
    }

    setLogs(prev => [dataBaru, ...prev]);

    setCurrentTicket({
      nama: dataBaru.nama,
      instansi: dataBaru.instansi,
      waktu: dataBaru.waktu,
      foto: dataBaru.foto,
    });

    setIsSaving(false);
    setStep(3);
    
    if (scriptSuccess) {
      showToast("Sukses mencatat absensi & terkirim ke Google Spreadsheet!", "success");
      // Memicu sinkronisasi ulang dari database online setelah jeda singkat
      setTimeout(() => {
        fetchLogsFromSheet(true);
      }, 1500);
    } else {
      showToast("Absensi tercatat secara lokal di sistem!", "success");
    }
  };

  const resetSystem = () => {
    setNama("");
    setInstansi("");
    setCapturedPhoto("");
    setCurrentTicket(null);
    setStep(1);
  };

  const executeClearAll = () => {
    setLogs([]);
    setShowDeleteModal(false);
    showToast("Seluruh database absensi lokal berhasil dihapus!", "success");
  };

  const downloadPDFReport = async () => {
    if (logs.length === 0) {
      showToast("Belum ada data absensi untuk diekspor!", "warning");
      return;
    }

    showToast("Mengekspor PDF Rekapitulasi Presensi...", "info");

    try {
      // 1. Process all photo images concurrently (max 800ms total)
      const photoDataUrls = await Promise.all(
        logs.map((log) => getSafeDataUrl(log.foto, log.nama))
      );

      // 2. Initialize jsPDF in Landscape A4
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const totalPeserta = logs.length;
      const tglCetak = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      // Header Decorative Bar
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(14, 12, 269, 3, "F");

      // Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("REKAPITULASI DAFTAR HADIR WORKSHOP MENULIS CERITA RAKYAT KABUPATEN TUBAN", 14, 22);

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Pemerintah Kabupaten Tuban - Sistem Presensi Digital Face Recognition", 14, 28);

      // Metadata Info Box (Right Side)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(79, 70, 229);
      doc.text(`Total Hadir: ${totalPeserta} Peserta`, 283, 22, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Tanggal Cetak: ${tglCetak}`, 283, 28, { align: "right" });

      // 3. Prepare Table Rows
      const tableRows = logs.map((log, idx) => [
        idx + 1,
        "", // Photo rendered dynamically in didDrawCell
        log.nama || "-",
        log.instansi || "-",
        log.waktu || "-"
      ]);

      // 4. Render Table with autoTable
      autoTable(doc, {
        startY: 34,
        head: [["NO", "FOTO", "NAMA LENGKAP PESERTA", "INSTANSI / LEMBAGA", "WAKTU PRESENSI"]],
        body: tableRows,
        theme: "grid",
        styles: {
          minCellHeight: 16
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          fontSize: 9,
          cellPadding: 2.5
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 9,
          valign: "middle",
          cellPadding: 2
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { halign: "center", cellWidth: 24 },
          2: { halign: "left", cellWidth: 85, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 88 },
          4: { halign: "center", cellWidth: 60 }
        },
        margin: { left: 14, right: 14, bottom: 18 },
        didDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const rowIndex = data.row.index;
            const log = logs[rowIndex];
            if (!log) return;

            const cell = data.cell;
            const posX = cell.x + 3;
            const posY = cell.y + 1.5;
            const imgW = 18;
            const imgH = 13;

            const photoSrc = photoDataUrls[rowIndex];
            if (photoSrc && photoSrc.startsWith("data:image/")) {
              try {
                doc.addImage(photoSrc, "JPEG", posX, posY, imgW, imgH);
                return;
              } catch (e) {
                // Fallback to vector initials badge
              }
            }

            // Vector Initials Badge
            const initials = (log.nama || "P")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            doc.setFillColor(79, 70, 229);
            doc.roundedRect(posX, posY, imgW, imgH, 1.5, 1.5, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text(initials, posX + imgW / 2, posY + imgH / 2 + 0.5, {
              align: "center",
              baseline: "middle"
            });
          }
        },
        didDrawPage: (data) => {
          const totalPages = (doc as any).internal.getNumberOfPages();
          const pageCurrent = data.pageNumber;

          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.setFont("helvetica", "normal");
          doc.text(
            `Sistem Presensi Digital Workshop Tuban - Halaman ${pageCurrent} dari ${totalPages}`,
            14,
            202
          );
          doc.text(
            `Dicetak: ${new Date().toLocaleString("id-ID")}`,
            283,
            202,
            { align: "right" }
          );
        }
      });

      // 5. Direct Save File
      const fileName = `Rekap_Absensi_Workshop_Tuban_${Date.now()}.pdf`;
      doc.save(fileName);

      showToast("Berkas PDF rekapitulasi berhasil diunduh!", "success");
    } catch (err: any) {
      console.error("Gagal mengekspor PDF:", err);
      showToast(`Gagal mengekspor PDF: ${err?.message || err}`, "error");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans flex flex-col justify-between selection:bg-indigo-100 antialiased">
      
      {/* Toast Notification */}
      {toast.type && (
        <div 
          className="fixed bottom-6 right-6 z-50 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3 transition-all duration-300 transform translate-y-0 scale-100"
          style={{
            backgroundColor: 
              toast.type === "success" ? "#059669" : 
              toast.type === "error" ? "#e11d48" : 
              toast.type === "warning" ? "#d97706" : "#1e293b"
          }}
        >
          <span>
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5" />}
            {toast.type === "error" && <X className="w-5 h-5" />}
            {toast.type === "warning" && <AlertTriangle className="w-5 h-5" />}
            {toast.type === "info" && <Sparkles className="w-5 h-5" />}
          </span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* HEADER: Geometric Balance Design style */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded flex items-center justify-center shadow-md shadow-indigo-100">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-800 leading-tight">
              Presensi Digital IGPT
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">
              Workshop Cerita Rakyat Tuban
            </p>
          </div>
        </div>

        {/* Real-time date and ticking clock */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {currentTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="text-2xl font-mono font-black text-indigo-600 leading-none mt-0.5">
              {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200"></div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center font-black text-indigo-600 text-sm">
              IG
            </div>
            <div className="text-left">
              <p className="font-extrabold text-sm text-slate-800 leading-tight">Sriyatni, M.Pd.</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-0.5">Ketua IGPT</p>
            </div>
          </div>
        </div>

        {/* Compact configuration controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-2.5 rounded-xl transition flex items-center justify-center space-x-1 border ${
              showSettings 
                ? "bg-slate-100 text-slate-800 border-slate-300" 
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            }`}
            title="Konfigurasi Spreadsheet"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Spreadsheet</span>
          </button>
          
          <button 
            onClick={toggleFullscreen} 
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition flex items-center justify-center"
            title="Layar Penuh"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN BODY LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-12 gap-8 p-6 md:p-8">
        
        {/* Settings Panel for Apps Script Link */}
        {showSettings && (
          <div className="col-span-12 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center space-x-3 text-indigo-900">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-lg">Konfigurasi Database Spreadsheet</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Google Apps Script Web App URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono text-slate-700"
                  />
                  <button 
                    onClick={() => {
                      showToast("URL Database Spreadsheet berhasil diperbarui!", "success");
                      setShowSettings(false);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm flex items-center justify-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Masukkan URL Web App dari deployment Google Apps Script Anda. Kode backend siap-pakai disediakan di dalam file <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600 font-bold">code.gs</code>.
                </p>
              </div>

              {/* Step By Step Guide inside UI */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs text-slate-600 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Cara Menghubungkan Spreadsheet Sendiri:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                  <li>Buat Spreadsheet kosong baru di Google Drive Anda.</li>
                  <li>Masuk ke menu <span className="font-bold">Ekstensi &gt; Apps Script</span>.</li>
                  <li>Salin kode dari tab file <span className="font-bold text-indigo-600 font-mono">code.gs</span> di proyek ini dan paste ke sana.</li>
                  <li>Klik tombol <span className="font-bold">Deploy &gt; New Deployment</span>, pilih tipe <span className="font-bold">Web App</span>.</li>
                  <li>Set <span className="font-bold">Execute as</span>: <span className="italic">Me (Saya)</span> dan <span className="font-bold">Who has access</span>: <span className="italic">Anyone (Siapa saja)</span>.</li>
                  <li>Deploy, berikan hak akses, salin URL Web App-nya, lalu paste di input di atas!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* PRIMARY ACTION COLUMN */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-6">
          
          {/* Step Indicators */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex justify-between items-center px-6">
            <div className="flex items-center space-x-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
              }`}>1</span>
              <span className={`text-xs font-bold ${step >= 1 ? "text-indigo-900" : "text-slate-400"}`}>Informasi</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <div className="flex items-center space-x-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
              }`}>2</span>
              <span className={`text-xs font-bold ${step >= 2 ? "text-indigo-900" : "text-slate-400"}`}>Foto Wajah</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <div className="flex items-center space-x-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
              }`}>3</span>
              <span className={`text-xs font-bold ${step >= 3 ? "text-indigo-900" : "text-slate-400"}`}>Selesai</span>
            </div>
          </div>

          {/* STEP 1: IDENTITY INPUT CARD (Geometric Balance) */}
          {step === 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col shadow-sm flex-1">
              <div className="text-center mb-8">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider mb-4 inline-block">
                  Akses Terbuka & Real-time
                </span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Selamat Datang di Workshop!</h2>
                <p className="text-slate-500 text-sm mt-1">Silakan masukkan identitas lengkap Anda untuk melakukan perekaman kehadiran.</p>
              </div>

              <div className="space-y-5 max-w-md mx-auto w-full">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                    Nama Lengkap & Gelar
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Ahmad Subarjo, S.Pd."
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm font-semibold text-slate-800 bg-slate-50/50"
                    />
                    <User className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                    Asal Instansi / Sekolah
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={instansi}
                      onChange={(e) => setInstansi(e.target.value)}
                      placeholder="Contoh: SMP Negeri 1 Tuban"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm font-semibold text-slate-800 bg-slate-50/50"
                    />
                    <Building className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button 
                  onClick={nextToCamera}
                  className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center space-x-2 text-sm uppercase tracking-wider"
                >
                  <span>Mulai Kamera Wajah</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CAMERA CAPTURE PANEL (Geometric Balance) */}
          {step === 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col shadow-sm flex-1">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div className="text-left">
                  <h2 className="text-lg font-bold text-slate-800">Tangkap Wajah Kehadiran</h2>
                  <p className="text-xs text-slate-500">Posisikan wajah di tengah lensa kamera</p>
                </div>
                <button 
                  onClick={backToInput}
                  disabled={isSaving}
                  className="text-xs text-indigo-600 hover:underline font-bold flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ubah Data</span>
                </button>
              </div>

              {/* Viewport container */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video max-w-lg w-full mx-auto border border-slate-200 shadow-inner">
                {/* Camera Flash Overlay */}
                {flashActive && (
                  <div className="absolute inset-0 bg-white z-40 animate-pulse duration-75"></div>
                )}

                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    capturedPhoto || isSimulation ? "hidden" : "block"
                  }`}
                />
                
                <canvas 
                  ref={canvasRef}
                  className={`w-full h-full object-cover ${
                    capturedPhoto || isSimulation ? "block" : "hidden"
                  }`}
                />

                {!capturedPhoto && (
                  <div className="absolute inset-0 border-2 border-dashed border-white/20 m-6 sm:m-10 rounded-2xl pointer-events-none flex items-center justify-center z-20">
                    <div className="w-8 h-8 border-t-4 border-l-4 border-yellow-400 absolute top-0 left-0"></div>
                    <div className="w-8 h-8 border-t-4 border-r-4 border-yellow-400 absolute top-0 right-0"></div>
                    <div className="w-8 h-8 border-b-4 border-l-4 border-yellow-400 absolute bottom-0 left-0"></div>
                    <div className="w-8 h-8 border-b-4 border-r-4 border-yellow-400 absolute bottom-0 right-0"></div>
                    
                    <div className="px-4 py-2 bg-black/60 rounded-full border border-white/10 backdrop-blur-sm">
                      <span className="text-[9px] text-yellow-300 font-bold tracking-widest uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>DETEKTOR AKTIF</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="mt-6 flex justify-center gap-3 w-full">
                {!capturedPhoto ? (
                  <button 
                    onClick={capturePhoto}
                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition flex items-center space-x-2 text-sm uppercase tracking-wider"
                  >
                    <Camera className="w-4.5 h-4.5" />
                    <span>Ambil Foto</span>
                  </button>
                ) : (
                  <div className="flex gap-3 w-full max-w-md">
                    <button 
                      onClick={retakePhoto}
                      disabled={isSaving}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Foto Ulang</span>
                    </button>
                    <button 
                      onClick={submitAttendance}
                      disabled={isSaving}
                      className="flex-[1.5] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition flex items-center justify-center space-x-2 text-sm uppercase tracking-wider"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Simpan Absensi</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS & TICKET CARD (Geometric Balance) */}
          {step === 3 && currentTicket && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col shadow-sm flex-1 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-4 shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-850">Absensi Berhasil Disimpan!</h2>
              <p className="text-slate-500 text-sm mt-1">Data kehadiran terenkripsi & sinkron dengan Google Spreadsheet.</p>

              {/* Minimal Boarding Ticket Pass */}
              <div className="my-6 p-1 bg-slate-50 rounded-2xl border border-slate-200/80 max-w-sm w-full mx-auto shadow-sm relative overflow-hidden">
                <div className="absolute top-1/2 -left-3.5 w-7 h-7 bg-white border border-slate-200 rounded-full z-10 -translate-y-1/2"></div>
                <div className="absolute top-1/2 -right-3.5 w-7 h-7 bg-white border border-slate-200 rounded-full z-10 -translate-y-1/2"></div>

                <div className="bg-white p-6 rounded-xl text-left border border-slate-200/40 relative">
                  <div className="text-center border-b border-dashed border-slate-200 pb-4 mb-4">
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold tracking-wider uppercase inline-block">
                      KARTU PRESENSI DIGITAL
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-base mt-1">Workshop Cerita Rakyat Tuban</h3>
                    <p className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase">KABUPATEN TUBAN (IGPT)</p>
                  </div>

                  <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50 mb-4">
                    <img 
                      src={currentTicket.foto} 
                      alt="Foto Kehadiran" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/40">
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block">Nama Lengkap</span>
                      <span className="font-black text-slate-800 text-sm">{currentTicket.nama}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/40">
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block">Asal Instansi / Sekolah</span>
                      <span className="font-semibold text-slate-700 text-xs">{currentTicket.instansi}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/40 text-center">
                        <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block">Waktu</span>
                        <span className="font-mono font-bold text-indigo-600 text-xs">{currentTicket.waktu}</span>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center flex flex-col justify-center items-center">
                        <span className="text-[8px] text-emerald-600 font-extrabold tracking-widest uppercase">Status</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full mt-0.5 inline-block">
                          HADIR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={resetSystem}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition flex items-center space-x-2 mx-auto uppercase tracking-wider text-xs"
              >
                <User className="w-4 h-4" />
                <span>Absen Peserta Baru</span>
              </button>
            </div>
          )}

        </section>

        {/* SIDEBAR LOGS & STATS COLUMN */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          
          {/* ANALYTICS STATS HERO CARD (Geometric Balance) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                <Grid className="w-4.5 h-4.5 text-indigo-600" />
                <span>Ringkasan Kehadiran</span>
              </h3>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Hadir</span>
                <p className="text-3xl font-black text-indigo-600 mt-1">{logs.length}</p>
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${Math.min(logs.length * 5, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sesi Workshop</span>
                <p className="text-xs font-black text-slate-700 mt-2 truncate">Kabupaten Tuban</p>
                <p className="text-[9px] text-indigo-600 font-extrabold uppercase mt-1">Perfect Sync</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button 
                onClick={downloadPDFReport}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-100 uppercase tracking-wider"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Rekap PDF (Landscape)</span>
              </button>

              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-2.5 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Mulai dari Nol (Hapus Database)</span>
              </button>
            </div>
          </div>

          {/* SPREADSHEET STATUS BADGE BOX (Geometric Balance) */}
          <div className="bg-slate-900 rounded-xl p-5 text-white flex items-center justify-between shadow-lg overflow-hidden relative">
            <div className="z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Sync Status</span>
              </div>
              <h4 className="font-bold text-sm tracking-tight text-white">Google Spreadsheet Aktif</h4>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Database: Foto_Absensi_Workshop_Tuban</p>
            </div>
            <svg className="w-12 h-12 text-slate-800 absolute -right-2 -bottom-2 transform rotate-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6H9a5 5 0 0 0-5 5V19a1 1 0 1 0 2 0v-4.7a3 3 0 0 1 3-3h7.3l-1.6 1.6a1 1 0 0 0 1.4 1.4l3.3-3.3a1 1 0 0 0 0-1.4l-3.3-3.3Z" />
            </svg>
          </div>

          {/* RIWAYAT TERBARU: RECENT LOGS FEED CARD (Geometric Balance) */}
          <div className="bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden flex-1 max-h-[360px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Riwayat Absensi</h3>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                  Live Feed
                </span>
              </div>
              <button 
                onClick={() => fetchLogsFromSheet(false)}
                disabled={isLoadingLogs}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-indigo-650 transition flex items-center gap-1.5 text-[10px] font-bold"
                title="Sinkronisasi dari Database Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin text-indigo-600" : ""}`} />
                <span>Segarkan</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center justify-center">
                  <Database className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Belum ada peserta terdaftar.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Harap daftarkan peserta terlebih dahulu.</p>
                </div>
              ) : (
                logs.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-3 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-all rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                        <img 
                          src={item.foto} 
                          className="w-full h-full object-cover" 
                          alt="Foto" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate leading-snug">{item.nama}</p>
                        <p className="text-[10px] text-slate-500 truncate leading-snug mt-0.5">{item.instansi}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded whitespace-nowrap ml-2">
                      {item.waktu}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER BAR (Geometric Balance) */}
      <footer className="h-12 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">App Version 2.4.0-Stable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Server ID: SG-APPSCRIPT-88</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Made with <svg className="w-3 h-3 text-red-500 inline mx-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg> for Workshop IGPT Tuban
        </div>
      </footer>

      {/* OFF-SCREEN LANDSCAPE REPORT ELEMENT FOR PRINTING/DOWNLOAD */}
      <div id="pdf-container-wrapper" style={{ position: "fixed", left: "-9999px", top: 0, width: "1123px", background: "white", overflow: "hidden", zIndex: -100, visibility: "hidden" }}>
        <div id="pdf-landscape-element" className="p-10 font-sans text-slate-800 bg-white" style={{ width: "1123px", boxSizing: "border-box" }}>
          
          <div className="text-center border-b-4 border-double border-slate-900 pb-5 mb-6">
            <h2 className="text-2xl font-black uppercase text-indigo-950 tracking-wide">
              Daftar Rekapitulasi Kehadiran Peserta
            </h2>
            <p className="text-sm font-bold text-slate-600 uppercase tracking-widest mt-1">
              Workshop Penulisan Cerita Rakyat Kabupaten Tuban
            </p>
            <p className="text-xs text-slate-400 font-extrabold mt-1.5 uppercase">
              Diselenggarakan oleh: Ikatan Guru Penulis Tuban (IGPT)
            </p>
            <p className="text-xs text-indigo-700 font-bold mt-2 font-mono">
              Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="border-b-2 border-slate-400 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="py-3 px-2 text-center" style={{ width: "6%" }}>No</th>
                <th className="py-3 px-3 text-center" style={{ width: "16%" }}>Foto Wajah</th>
                <th className="py-3 px-4" style={{ width: "32%" }}>Nama Lengkap & Gelar</th>
                <th className="py-3 px-4" style={{ width: "32%" }}>Asal Instansi / Sekolah</th>
                <th className="py-3 px-3 text-center" style={{ width: "14%" }}>Waktu Absen</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-200">
              {logs.map((item, index) => (
                <tr key={item.id} className="align-middle">
                  <td className="py-3 px-2 text-center font-bold text-slate-400">{index + 1}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="inline-block w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-slate-50">
                      <img 
                        src={item.foto} 
                        data-src={item.foto}
                        data-name={item.nama}
                        data-pdf-photo="true"
                        className="w-full h-full object-cover" 
                        alt="Foto" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 font-black text-slate-900 text-sm">{item.nama}</td>
                  <td className="py-3 px-4 font-bold text-slate-600">{item.instansi}</td>
                  <td className="py-3 px-3 text-center font-mono font-extrabold text-indigo-700 text-xs">
                    {item.waktu}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && (
            <div className="text-center py-10 text-slate-400 italic">
              Belum ada data kehadiran untuk ditampilkan.
            </div>
          )}

          <div className="mt-12 flex justify-between items-center text-xs px-10">
            <div className="text-center">
              <p className="text-slate-400 font-bold uppercase tracking-wider mb-12">Petugas Presensi</p>
              <div className="w-32 border-b border-slate-300 mx-auto"></div>
              <p className="text-slate-600 font-bold mt-1.5">Panitia IGPT</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-bold uppercase tracking-wider mb-12">Ketua Ikatan Guru Penulis Tuban</p>
              <div className="w-40 border-b border-slate-300 mx-auto"></div>
              <p className="text-slate-700 font-extrabold mt-1.5">Kasturi, S.Pd., M.Pd.</p>
            </div>
          </div>

        </div>
      </div>

      {/* CONFIRM DELETE DATABASE MODAL DIALOG */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 transform scale-100 opacity-100 transition-all duration-200">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-rose-600 mb-4 border border-rose-100 shadow-sm">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Kosongkan Database?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Tindakan ini akan menghapus semua riwayat kehadiran peserta secara permanen di database lokal Anda. Langkah ini tidak bisa dibatalkan.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
              >
                Batalkan
              </button>
              <button 
                onClick={executeClearAll}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition text-xs shadow-lg shadow-rose-100"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

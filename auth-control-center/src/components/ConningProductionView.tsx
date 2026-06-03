import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { ConningProduction, DyeingProduction, HanksProduction, GreyStock, ReadyStock } from "../types";
import { 
  Search, Plus, Edit2, Eye, Trash2, RotateCcw, Box, Layers, 
  AlertCircle, Check, QrCode, Printer, CheckCircle, X, 
  SearchCode, Sparkles, Filter, Weight, HelpCircle, Package, ArrowRight
} from "lucide-react";

interface ConningProductionViewProps {
  role: string;
}

const QUALITY_OPTIONS = ["Pass", "Reject"] as const;
const STATUS_OPTIONS = ["Pending", "Processing", "Completed"] as const;

export const ConningProductionView: React.FC<ConningProductionViewProps> = ({ role }) => {
  const [connings, setConnings] = useState<ConningProduction[]>([]);
  const [dyeings, setDyeings] = useState<DyeingProduction[]>([]);
  const [hanksProds, setHanksProds] = useState<HanksProduction[]>([]);
  const [greyStocks, setGreyStocks] = useState<GreyStock[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingConning, setEditingConning] = useState<ConningProduction | null>(null);

  // Form states
  const [lotId, setLotId] = useState("");
  const [bagNo, setBagNo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [shade, setShade] = useState("");
  const [coneWeight, setConeWeight] = useState("");
  const [conesCount, setConesCount] = useState("");
  const [outputKg, setOutputKg] = useState("");
  const [quality, setQuality] = useState<"Pass" | "Reject">("Pass");
  const [status, setStatus] = useState<"Pending" | "Processing" | "Completed">("Completed");

  // Auxiliary fields for instant ReadyStock generation on Pass + Completed
  const [readyGrade, setReadyGrade] = useState<"A Grade" | "Standard Grade" | "B Grade">("A Grade");
  const [warehouseLocation, setWarehouseLocation] = useState("Zone A-1");

  // QR scan logic
  const [scannedCode, setScannedCode] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    success: boolean;
    message: string;
    details?: {
      lotId: string;
      bagNo: string;
      partyName: string;
      shade: string;
      weight: number;
    };
  } | null>(null);

  const [viewingConning, setViewingConning] = useState<ConningProduction | null>(null);

  // Load data real-time from Firestore
  useEffect(() => {
    setLoading(true);

    const unsubscribeConnings = onSnapshot(
      collection(db, "conning_productions"),
      (snap) => {
        const list: ConningProduction[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as ConningProduction);
        });
        setConnings(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        // Silently capture or forward errors
        console.error("Firestore loading error:", err);
      }
    );

    const unsubscribeDyeings = onSnapshot(
      collection(db, "dyeing_productions"),
      (snap) => {
        const list: DyeingProduction[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as DyeingProduction;
          if (!data.isDeleted) list.push(data);
        });
        setDyeings(list);
      }
    );

    const unsubscribeHanks = onSnapshot(
      collection(db, "hanks_productions"),
      (snap) => {
        const list: HanksProduction[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as HanksProduction;
          if (!data.isDeleted) list.push(data);
        });
        setHanksProds(list);
      }
    );

    const unsubscribeGrey = onSnapshot(
      collection(db, "grey_stocks"),
      (snap) => {
        const list: GreyStock[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as GreyStock;
          if (!data.isDeleted) list.push(data);
        });
        setGreyStocks(list);
      }
    );

    return () => {
      unsubscribeConnings();
      unsubscribeDyeings();
      unsubscribeHanks();
      unsubscribeGrey();
    };
  }, []);

  // Calculate Output weight automatically
  useEffect(() => {
    const wt = parseFloat(coneWeight);
    const cnt = parseInt(conesCount, 10);
    if (!isNaN(wt) && !isNaN(cnt) && wt > 0 && cnt > 0) {
      setOutputKg((wt * cnt).toFixed(3));
    }
  }, [coneWeight, conesCount]);

  // Compute CP sequence
  const generateNextConningId = (): string => {
    let maxNum = 0;
    connings.forEach((c) => {
      const match = c.conningId.match(/^CP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `CP-${String(maxNum + 1).padStart(4, "0")}`;
  };

  // Compute RS sequence
  const generateNextReadyStockId = async (): Promise<string> => {
    // We can count existing stocks or query it. To stay clean, we fetch next serial
    return new Promise((resolve) => {
      const unsubscribe = onSnapshot(
        collection(db, "ready_stocks"),
        (snap) => {
          let maxNum = 0;
          snap.forEach((d) => {
            const data = d.data();
            const match = (data.stockId || "").match(/^RS-(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          });
          unsubscribe();
          resolve(`RS-${String(maxNum + 1).padStart(4, "0")}`);
        }
      );
    });
  };

  // Simulated Barcode QR scan
  const handleQRScan = (codeToScan: string) => {
    const code = codeToScan.trim().toUpperCase();
    if (!code) {
      setScanFeedback({ success: false, message: "Please enter a QR string to simulate." });
      return;
    }

    // Try 1: Search Dyeing productions first (Since conning generally happens after dyeing)
    const foundDyeing = dyeings.find(
      (d) => d.dyeingId.toUpperCase() === code || d.bagNo.toUpperCase() === code
    );
    if (foundDyeing) {
      setScanFeedback({
        success: true,
        message: `Successfully scanned dyed batch record: ${foundDyeing.dyeingId}`,
        details: {
          lotId: foundDyeing.lotId,
          bagNo: foundDyeing.bagNo,
          partyName: foundDyeing.partyName,
          shade: foundDyeing.shade,
          weight: foundDyeing.outputKg
        }
      });
      return;
    }

    // Try 2: Search Hanks productions
    const foundHanks = hanksProds.find(
      (h) => h.productionId.toUpperCase() === code || h.bagNo.toUpperCase() === code
    );
    if (foundHanks) {
      const matchedGrey = greyStocks.find((g) => g.lotId === foundHanks.lotId);
      const party = matchedGrey ? matchedGrey.partyName : "Unknown Client";
      setScanFeedback({
        success: true,
        message: `Successfully scanned reeled bag record: ${foundHanks.bagNo}`,
        details: {
          lotId: foundHanks.lotId,
          bagNo: foundHanks.bagNo,
          partyName: party,
          shade: "Undyed Grey Yarn",
          weight: foundHanks.outputKg
        }
      });
      return;
    }

    // Try 3: Search raw grey lots directly
    const foundGrey = greyStocks.find((g) => g.lotId.toUpperCase() === code);
    if (foundGrey) {
      setScanFeedback({
        success: true,
        message: `Scanned raw Grey stock lot ID: ${foundGrey.lotId}`,
        details: {
          lotId: foundGrey.lotId,
          bagNo: `${foundGrey.lotId}-G01`,
          partyName: foundGrey.partyName,
          shade: "Grey Raw Thread",
          weight: foundGrey.receivedQtyKg
        }
      });
      return;
    }

    setScanFeedback({
      success: false,
      message: `No active production or lot barcode matches found for code "${code}".`
    });
  };

  const applyScanAutofill = () => {
    if (!scanFeedback?.details) return;
    const { lotId, bagNo, partyName, shade, weight } = scanFeedback.details;
    setLotId(lotId);
    setBagNo(bagNo);
    setPartyName(partyName);
    setShade(shade);
    setOutputKg(weight.toString());
    setScanFeedback(null);
    setScannedCode("");
    setSuccessMsg(`Auto-populated details for Party: [${partyName}], Lot/Bag: [${lotId} / ${bagNo}]. Ready for cone winding metrics.`);
  };

  // Open creation or edit form modal
  const triggerForm = (conn: ConningProduction | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setScanFeedback(null);
    setScannedCode("");

    if (conn) {
      setEditingConning(conn);
      setLotId(conn.lotId);
      setBagNo(conn.bagNo);
      setPartyName(conn.partyName);
      setShade(conn.shade);
      setConeWeight(conn.coneWeight.toString());
      setConesCount(conn.conesCount.toString());
      setOutputKg(conn.outputKg.toString());
      setQuality(conn.quality);
      setStatus(conn.status);
    } else {
      setEditingConning(null);
      setLotId("");
      setBagNo("");
      setPartyName("");
      setShade("");
      setConeWeight("1.15"); // default target yarn cone weight
      setConesCount("40");    // default pack count
      setOutputKg("46.0");
      setQuality("Pass");
      setStatus("Completed");
    }
    setReadyGrade("A Grade");
    setWarehouseLocation("Zone A-1");
    setIsOpenForm(true);
  };

  // Handle Form Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const numConeWeight = parseFloat(coneWeight);
    const numConesCount = parseInt(conesCount, 10);
    const numOutputKg = parseFloat(outputKg);

    if (!lotId || !bagNo) {
      setErrorMsg("Lot and original Bag/Batch reference are required. Simulated scan or select a lot.");
      return;
    }

    if (!partyName) {
      setErrorMsg("Client party reference missing.");
      return;
    }

    if (!shade) {
      setErrorMsg("Yarn color shade description required.");
      return;
    }

    if (isNaN(numConeWeight) || numConeWeight <= 0) {
      setErrorMsg("Cone weight (Kg) must be a positive number.");
      return;
    }

    if (isNaN(numConesCount) || numConesCount <= 0) {
      setErrorMsg("Cones count must be a positive integer.");
      return;
    }

    if (isNaN(numOutputKg) || numOutputKg <= 0) {
      setErrorMsg("Output net weight must be a positive number.");
      return;
    }

    try {
      const isNew = !editingConning;
      const conningId = isNew ? generateNextConningId() : editingConning!.conningId;
      const docRef = doc(db, "conning_productions", conningId);

      const payload: ConningProduction = {
        conningId,
        lotId,
        bagNo,
        partyName,
        shade,
        coneWeight: numConeWeight,
        conesCount: numConesCount,
        outputKg: parseFloat(numOutputKg.toFixed(3)),
        quality,
        status,
        isDeleted: isNew ? false : editingConning!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingConning!.createdAt
      };

      // 1. Write the Conning document
      await setDoc(docRef, payload);

      // 2. Ready Stock Automation
      // If quality is "Pass" and Status is "Completed", automatically push/upsert to ready_stocks database!
      if (quality === "Pass" && status === "Completed") {
        const stockId = await generateNextReadyStockId();
        const stockRef = doc(db, "ready_stocks", stockId);

        const stockPayload: ReadyStock = {
          stockId,
          lotId,
          bagNo,
          partyName,
          shade,
          conesCount: numConesCount,
          weightKg: parseFloat(numOutputKg.toFixed(3)),
          grade: readyGrade,
          warehouseLocation: warehouseLocation.trim() || "Unassigned Zone",
          status: "Available",
          conningIdReference: conningId,
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(stockRef, stockPayload);
        setSuccessMsg(`Cone Winding run ${conningId} recorded. Passed quality successfully and auto-transferred to Ready Stock [Ref: ${stockId}] inside warehouse racking [${warehouseLocation}].`);
      } else {
        setSuccessMsg(`Cone Winding run ${conningId} updated successfully. Quality: [${quality}], Status: [${status}].`);
      }

      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to write conning production parameters to Firestore.");
      console.error(err);
    }
  };

  // Archive / Soft Delete Toggle
  const handleArchiveToggle = async (conn: ConningProduction) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "conning_productions", conn.conningId);
      await updateDoc(docRef, {
        isDeleted: !conn.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Conning Run ${conn.conningId} has been successfully ${conn.isDeleted ? "restored" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Failed to update soft archive status.");
    }
  };

  // Sticker Ticket Print helper for cones package box
  const printPackageSticker = (conn: ConningProduction) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Wound Yarns Cone Package Ticket - ${conn.conningId}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; margin: 30px; text-align: center; }
            .badge { border: 4px double #000; padding: 20px; border-radius: 8px; max-width: 420px; margin: 0 auto; }
            h2 { font-size: 22px; margin: 0 0 10px 0; border-bottom: 2px solid #000; padding-bottom: 5px; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; border-bottom: 1px dashed #aaa; }
            .footer { font-size: 10px; margin-top: 20px; color: #666; }
            .qr { margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="badge">
            <h2>Cone Package Ticket</h2>
            <div class="row"><strong>Run Batch ID:</strong> <span>${conn.conningId}</span></div>
            <div class="row"><strong>Yarn Lot Reference:</strong> <span>${conn.lotId}</span></div>
            <div class="row"><strong>Bag Barcode:</strong> <span>${conn.bagNo}</span></div>
            <div class="row"><strong>Client Party:</strong> <span>${conn.partyName}</span></div>
            <div class="row"><strong>Color Shade:</strong> <span>${conn.shade}</span></div>
            <div class="row"><strong>Avg Cone Weight:</strong> <span>${conn.coneWeight.toFixed(3)} Kg/Cone</span></div>
            <div class="row"><strong>Cones Inside:</strong> <span>${conn.conesCount} Pcs</span></div>
            <div class="row"><strong>Net Box Weight:</strong> <span>${conn.outputKg.toFixed(2)} Kg</span></div>
            <div class="row"><strong>QC Quality status:</strong> <span>${conn.quality}</span></div>
            <div class="row"><strong>Processing state:</strong> <span>${conn.status}</span></div>

            <div class="qr">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(conn.conningId)}" alt="box sticker barcode logo" />
            </div>
            <div class="footer">Verified QC Conning Department Master ERP</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Apply listing query filters
  const filteredConnings = connings.filter((c) => {
    if (showSoftDeleted ? !c.isDeleted : c.isDeleted) return false;

    const term = search.toLowerCase();
    const matchesSearch =
      c.conningId.toLowerCase().includes(term) ||
      c.lotId.toLowerCase().includes(term) ||
      c.bagNo.toLowerCase().includes(term) ||
      c.partyName.toLowerCase().includes(term) ||
      c.shade.toLowerCase().includes(term);

    const matchesQuality = qualityFilter === "all" ? true : c.quality === qualityFilter;
    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;

    return matchesSearch && matchesQuality && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. BARCODE SCANNING SIMULATOR RIG */}
      <div className="bg-[#0e1633] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 font-sans">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-wider block">
            Scan QR Code Rig simulator (Conning Module)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-3xl leading-relaxed">
          Simulate a physical hand-held laser terminal. Paste or key in any Dyed Batch ID (e.g. <span className="font-mono text-indigo-300">DP-0001</span>), Hanks Bag number (e.g. <span className="font-mono text-cyan-300">L-001-B01</span>), or Grey lot code to resolve yarn client, color shade, and incoming weights from previous departments automatically.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-bold text-slate-500">Scan Input</label>
            <div className="relative">
              <SearchCode className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Paste code or scanner string..."
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQRScan(scannedCode);
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleQRScan(scannedCode)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Trigger Scan
          </button>
        </div>

        {/* Real-time scanning feedback result segment */}
        {scanFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs animate-fadeIn ${
            scanFeedback.success ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1 font-sans">
              <span className="font-semibold block">{scanFeedback.message}</span>
              {scanFeedback.details && (
                <div className="bg-[#0b122c]/65 p-3 rounded-lg border border-white/10 space-y-1.5 font-mono text-[11px] text-slate-300">
                  <div><strong>Lot ID Reference:</strong> <span className="text-white font-bold">{scanFeedback.details.lotId}</span></div>
                  <div><strong>Bag/Batch Code:</strong> <span className="text-white font-bold">{scanFeedback.details.bagNo}</span></div>
                  <div><strong>Client Party:</strong> <span className="text-white">{scanFeedback.details.partyName}</span></div>
                  <div><strong>Ref Shade Color:</strong> <span className="text-white italic">{scanFeedback.details.shade}</span></div>
                  <div><strong>Incoming Net Weight:</strong> <span className="text-cyan-400 font-bold">{scanFeedback.details.weight.toFixed(2)} Kg</span></div>
                </div>
              )}
              {scanFeedback.success && (
                <button
                  type="button"
                  onClick={applyScanAutofill}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-4 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Transfer Inputs & Open Form</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Dialog notifications */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs animate-fadeIn ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* 2. LEDGER FILTER ACTIONS TOOLBAR */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-[#0a1128]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 font-sans">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Query search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID, lot, client, color..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Filtering dropdown units */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">QC:</span>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All QC</option>
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSoftDeleted}
              onChange={(e) => setShowSoftDeleted(e.target.checked)}
              className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0"
            />
            <span>Show Archived</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Winding (Conning)</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. CONNING LEDGER LEDTABLE */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 font-mono">Conning Run ID</th>
                <th className="py-3.5 px-4">Lot & Bag ref</th>
                <th className="py-3.5 px-4">Client party</th>
                <th className="py-3.5 px-4">Yarn Shade Color</th>
                <th className="py-3.5 px-4 text-right">Cone Target Weight</th>
                <th className="py-3.5 px-4 text-center">Cones Count</th>
                <th className="py-3.5 px-4 text-right">Net Output weight</th>
                <th className="py-3.5 px-4 text-center">Quality Grade</th>
                <th className="py-3.5 px-4 text-center">Progress Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                    Syncing cone winding QC inspection databases...
                  </td>
                </tr>
              ) : filteredConnings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500 italic">
                    No matching Conning production runs recorded.
                  </td>
                </tr>
              ) : (
                filteredConnings.map((c) => (
                  <tr key={c.conningId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-indigo-400 font-extrabold">{c.conningId}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      <div className="text-slate-300 font-bold">{c.bagNo}</div>
                      <div>Lot: {c.lotId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-white font-semibold">{c.partyName}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono">
                        {c.shade || "Raw Grey"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">{c.coneWeight.toFixed(3)} Kg</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">{c.conesCount} Pcs</td>
                    <td className="py-3.5 px-4 text-right font-mono text-white font-extrabold">{c.outputKg.toFixed(2)} Kg</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold border ${
                        c.quality === "Pass" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {c.quality}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        c.status === "Completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        c.status === "Processing" ? "bg-indigo-500/10 text-indigo-405 border-indigo-500/20 animate-pulse" :
                        "bg-slate-500/10 text-slate-400 border-white/10"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingConning(c)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-slate-300 transition-colors cursor-pointer"
                          title="Full QC Metrics"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => printPackageSticker(c)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-indigo-400 transition-colors cursor-pointer"
                          title="Print Box Ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(c)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Edit conning details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveToggle(c)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                c.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-500"
                              }`}
                              title={c.isDeleted ? "Recover" : "Soft Delete"}
                            >
                              {c.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. DIALOG MODAL: CONNING WORK CARD FORM */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/15 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto font-sans text-xs">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-400" />
                {editingConning ? `Configure Cone Wind Batch [${editingConning.conningId}]` : "Record New Conning Production Entry"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpenForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Interactive scanning helper directly inside form */}
              <div className="bg-[#0f193d] border border-indigo-500/15 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">
                    Fast Scanner Link Input
                  </span>
                  <span className="text-[10px] italic text-slate-400 font-mono">Scan Dyed/Hanks Box to autofill</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 border-b border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block font-bold">Simulate Laser QR Scan</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. DP-0001 or L-001-B01"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQRScan((e.target as HTMLInputElement).value);
                          }
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block font-bold">Or Select Dyed Batch Run</label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleQRScan(val);
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Choose active dyed package --</option>
                      {dyeings.map((d) => (
                        <option key={d.dyeingId} value={d.dyeingId}>
                          {d.dyeingId} ({d.partyName} - {d.shade})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Form parameters showing linked indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Lot Refer</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. L-001"
                      value={lotId}
                      onChange={(e) => setLotId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Bag/Batch ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. L-001-B01"
                      value={bagNo}
                      onChange={(e) => setBagNo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Client Party Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Party / Client"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Grid 2: Color and target cone winding metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yarn Shade Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sapphire Blue"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit Cone Weight (Kg)</label>
                  <div className="relative">
                    <Weight className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 1.15"
                      value={coneWeight}
                      onChange={(e) => setConeWeight(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cones Count (Pcs)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 40"
                    value={conesCount}
                    onChange={(e) => setConesCount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Net Output and State selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wound Net Weight (Output Kg)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Calculcalculated output weight Kg"
                    value={outputKg}
                    onChange={(e) => setOutputKg(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quality Audit Grade</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-bold cursor-pointer"
                  >
                    {QUALITY_OPTIONS.map((q) => (
                      <option key={q} value={q} className="bg-[#0b122c]">{q}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inspected State Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white cursor-pointer font-bold"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st} className="bg-[#0b122c]">{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ready Stock Automation Subform block (renders only if Quality = Pass and Status = Completed) */}
              {quality === "Pass" && status === "Completed" && (
                <div className="bg-[#10b981]/10 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10.5px] font-extrabold uppercase text-emerald-400 tracking-wider">
                      Ready Stock Automation ledger Setup
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This winding package has certified QC <span className="font-bold text-emerald-400">"Pass"</span>. Saving this form will automatically inward the yarn cones package directly into the finished goods Ready Stock inventory database! Provide storage logistics variables below:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-300 uppercase block">Finished Goods Packing Grade</label>
                      <select
                        value={readyGrade}
                        onChange={(e) => setReadyGrade(e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="A Grade">A Grade (Super premium soft-wound)</option>
                        <option value="Standard Grade">Standard Grade (Default export quality)</option>
                        <option value="B Grade">B Grade (Minor yarn hairiness)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-300 uppercase block">Warehouse Storage Rack Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Rack A-4 Shelf-1"
                        value={warehouseLocation}
                        onChange={(e) => setWarehouseLocation(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* actions buttons row */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer flex items-center gap-1"
                >
                  <span>Commit Winding QC Track</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SIDEWAYS DETAILS POPUP DIALOG */}
      {viewingConning && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 font-sans">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                Cone QC Run Audit Details
              </h3>
              <button
                type="button"
                onClick={() => setViewingConning(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Run Winding ID:</span>
                <span className="text-white font-bold">{viewingConning.conningId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Raw Lot Ref:</span>
                <span className="text-white">{viewingConning.lotId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Original Bag reference:</span>
                <span className="text-[#a5b4fc] font-bold">{viewingConning.bagNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 font-sans">
                <span>Client Entity/Party:</span>
                <span className="text-white font-semibold">{viewingConning.partyName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Yarn Color Shade:</span>
                <span className="text-cyan-400 font-semibold">{viewingConning.shade || "Grey Thread"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Unit Cone Weight:</span>
                <span className="text-white">{viewingConning.coneWeight.toFixed(3)} Kg/Cone</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Cones Wound Pack count:</span>
                <span className="text-emerald-400 font-bold">{viewingConning.conesCount} Cones</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Net Out Weight:</span>
                <span className="text-white font-extrabold">{viewingConning.outputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Quality grade check:</span>
                <span className={`font-bold ${viewingConning.quality === "Pass" ? "text-emerald-400" : "text-red-400"}`}>
                  {viewingConning.quality}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Batch Progress state:</span>
                <span className="text-white font-bold">{viewingConning.status}</span>
              </div>
            </div>

            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => {
                  printPackageSticker(viewingConning);
                  setViewingConning(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 font-sans font-bold text-white py-2 px-5 rounded-xl text-xs transition-colors tracking-wide cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Department Ticket Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

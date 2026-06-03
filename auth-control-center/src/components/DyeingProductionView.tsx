import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { DyeingProduction, HanksProduction, GreyStock, WorkerMaster, Shade, Machine, OperationType } from "../types";
import { 
  Search, Plus, Edit2, Eye, Trash2, RotateCcw, Box, User, Layers, 
  AlertCircle, ChevronRight, Check, QrCode, Printer, CheckCircle, 
  TrendingDown, Activity, RefreshCw, X, SearchCode, Shield, Sparkles, Filter, Database, HelpCircle
} from "lucide-react";

interface DyeingProductionViewProps {
  role: string;
}

const PRESET_STATUSES = ["Pending", "Running", "Completed", "Rework", "Rejected"];

export const DyeingProductionView: React.FC<DyeingProductionViewProps> = ({ role }) => {
  const [dyeings, setDyeings] = useState<DyeingProduction[]>([]);
  const [hanksProds, setHanksProds] = useState<HanksProduction[]>([]);
  const [greyStocks, setGreyStocks] = useState<GreyStock[]>([]);
  const [workers, setWorkers] = useState<WorkerMaster[]>([]);
  const [shades, setShades] = useState<Shade[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form modal states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingDyeing, setEditingDyeing] = useState<DyeingProduction | null>(null);

  // Form Field Input states
  const [lotId, setLotId] = useState("");
  const [bagNo, setBagNo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [shade, setShade] = useState("");
  const [recipe, setRecipe] = useState("");
  const [machineCode, setMachineCode] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [helperId, setHelperId] = useState("");
  const [inputKg, setInputKg] = useState("");
  const [outputKg, setOutputKg] = useState("");
  const [status, setStatus] = useState<DyeingProduction["status"]>("Pending");

  // QR Scanning Simulator input / fetch states
  const [scannedCode, setScannedCode] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    success: boolean;
    message: string;
    details?: {
      lotId: string;
      bagNo: string;
      partyName: string;
      weight: number;
    };
  } | null>(null);

  // View details and printing
  const [viewingDyeing, setViewingDyeing] = useState<DyeingProduction | null>(null);

  // Load Firestore collections real-time
  useEffect(() => {
    setLoading(true);

    const unsubscribeDyeings = onSnapshot(
      collection(db, "dyeing_productions"),
      (snap) => {
        const list: DyeingProduction[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as DyeingProduction);
        });
        setDyeings(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "dyeing_productions");
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
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "hanks_productions");
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
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "grey_stocks");
      }
    );

    const unsubscribeWorkers = onSnapshot(
      collection(db, "worker_masters"),
      (snap) => {
        const list: WorkerMaster[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as WorkerMaster;
          if (!data.isDeleted) list.push(data);
        });
        setWorkers(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "worker_masters");
      }
    );

    const unsubscribeShades = onSnapshot(
      collection(db, "shades"),
      (snap) => {
        const list: Shade[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Shade;
          if (!data.isDeleted) list.push(data);
        });
        setShades(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "shades");
      }
    );

    const unsubscribeMachines = onSnapshot(
      collection(db, "machines"),
      (snap) => {
        const list: Machine[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Machine;
          if (!data.isDeleted && data.status === "active") list.push(data);
        });
        setMachines(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "machines");
      }
    );

    return () => {
      unsubscribeDyeings();
      unsubscribeHanks();
      unsubscribeGrey();
      unsubscribeWorkers();
      unsubscribeShades();
      unsubscribeMachines();
    };
  }, []);

  // Compute next available sequence document ID
  const generateNextDyeingId = (): string => {
    let maxNum = 0;
    dyeings.forEach((d) => {
      const match = d.dyeingId.match(/^DP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `DP-${String(maxNum + 1).padStart(4, "0")}`;
  };

  // Perform Simulated barcode/QR scanning and Auto-Fetch
  const handleQRScan = (codeToScan: string) => {
    const code = codeToScan.trim().toUpperCase();
    if (!code) {
      setScanFeedback({ success: false, message: "Please enter a valid QR string to scan." });
      return;
    }

    // Attempt 1: Search hanks productions
    const foundHanks = hanksProds.find(
      (h) => h.bagNo.toUpperCase() === code || h.productionId.toUpperCase() === code
    );

    if (foundHanks) {
      const matchedGrey = greyStocks.find((g) => g.lotId === foundHanks.lotId);
      const computedParty = matchedGrey ? matchedGrey.partyName : "Unknown Supplier";
      
      setScanFeedback({
        success: true,
        message: `Successfully scanned Hanks Bag barcode: ${foundHanks.bagNo}`,
        details: {
          lotId: foundHanks.lotId,
          bagNo: foundHanks.bagNo,
          partyName: computedParty,
          weight: foundHanks.outputKg || foundHanks.inputKg
        }
      });
      return;
    }

    // Attempt 2: Search grey stocks directly
    const foundGrey = greyStocks.find((g) => g.lotId.toUpperCase() === code);
    if (foundGrey) {
      setScanFeedback({
        success: true,
        message: `Successfully scanned raw Grey Lot barcode: ${foundGrey.lotId}`,
        details: {
          lotId: foundGrey.lotId,
          bagNo: `${foundGrey.lotId}-G01`,
          partyName: foundGrey.partyName,
          weight: foundGrey.receivedQtyKg
        }
      });
      return;
    }

    // Fallback error
    setScanFeedback({
      success: false,
      message: `No active Hanks Bag Barcode or Lot registration found matching code "${code}".`
    });
  };

  const applyScanAutofill = () => {
    if (!scanFeedback?.details) return;
    const { lotId, bagNo, partyName, weight } = scanFeedback.details;

    setLotId(lotId);
    setBagNo(bagNo);
    setPartyName(partyName);
    setInputKg(weight.toString());
    setScanFeedback(null);
    setScannedCode("");
    setSuccessMsg(`Auto-fetched Party [${partyName}], Lot [${lotId}], Bag [${bagNo}], and Weight [${weight} Kg] successfully into the form fields.`);
  };

  const triggerForm = (dye: DyeingProduction | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setScanFeedback(null);
    setScannedCode("");

    if (dye) {
      setEditingDyeing(dye);
      setLotId(dye.lotId);
      setBagNo(dye.bagNo);
      setPartyName(dye.partyName);
      setShade(dye.shade);
      setRecipe(dye.recipe);
      setMachineCode(dye.machine);
      setOperatorId(dye.operatorId);
      setHelperId(dye.helperId);
      setInputKg(dye.inputKg.toString());
      setOutputKg(dye.outputKg.toString());
      setStatus(dye.status);
    } else {
      setEditingDyeing(null);
      setLotId("");
      setBagNo("");
      setPartyName("");
      setShade(shades[0]?.shadeCode || "");
      setRecipe("");
      setMachineCode(machines[0]?.machineCode || "");
      setOperatorId(workers[0]?.workerId || "");
      setHelperId(workers[1]?.workerId || workers[0]?.workerId || "");
      setInputKg("");
      setOutputKg("");
      setStatus("Pending");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeOperator = workers.find((w) => w.workerId === operatorId);
    const activeHelper = workers.find((w) => w.workerId === helperId);
    const numInput = parseFloat(inputKg);
    const numOutput = parseFloat(outputKg);

    if (!lotId || !bagNo) {
      setErrorMsg("Lot and Bag specifications are required. Use scan QR to auto-fetch or select active lot.");
      return;
    }

    if (!partyName) {
      setErrorMsg("Party Name must be registered or resolved.");
      return;
    }

    if (!shade) {
      setErrorMsg("Please specify a target shade code.");
      return;
    }

    if (!machineCode) {
      setErrorMsg("Please select an active dyeing machine asset.");
      return;
    }

    if (!operatorId || !activeOperator) {
      setErrorMsg("Please select an active Operator worker.");
      return;
    }

    if (!helperId || !activeHelper) {
      setErrorMsg("Please select an active Helper worker.");
      return;
    }

    if (isNaN(numInput) || numInput <= 0) {
      setErrorMsg("Input feedstock weight (Kg) must be positive.");
      return;
    }

    if (isNaN(numOutput) || numOutput < 0) {
      setErrorMsg("Output product weight (Kg) must be non-negative.");
      return;
    }

    const calculatedLoss = numInput > 0 ? ((numInput - numOutput) / numInput) * 100 : 0;

    try {
      const isNew = !editingDyeing;
      const dyeingId = isNew ? generateNextDyeingId() : editingDyeing!.dyeingId;

      const docRef = doc(db, "dyeing_productions", dyeingId);

      const payload: DyeingProduction = {
        dyeingId,
        lotId,
        bagNo,
        partyName,
        shade,
        recipe: recipe.trim(),
        machine: machineCode,
        operatorId,
        operatorName: activeOperator.workerName,
        helperId,
        helperName: activeHelper.workerName,
        inputKg: numInput,
        outputKg: numOutput,
        lossPercent: parseFloat(calculatedLoss.toFixed(2)),
        status,
        isDeleted: isNew ? false : editingDyeing!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingDyeing!.createdAt
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Dyeing production ${dyeingId} [Lot: ${lotId}] has been successfully saved.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Could not write Dyeing Production session to Firestore.");
      handleFirestoreError(err, editingDyeing ? OperationType.UPDATE : OperationType.CREATE, "dyeing_productions");
    }
  };

  const handleArchiveToggle = async (dye: DyeingProduction) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "dyeing_productions", dye.dyeingId);
      await updateDoc(docRef, {
        isDeleted: !dye.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Dyeing Batch ${dye.dyeingId} has been successfully ${dye.isDeleted ? "recovered" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Could not change document archive flag.");
      handleFirestoreError(err, OperationType.UPDATE, `dyeing_productions/${dye.dyeingId}`);
    }
  };

  const printSticker = (dye: DyeingProduction) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Dyeing Production Sticker - ${dye.dyeingId}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; margin: 40px; text-align: center; color: #000; }
            .badge { border: 3px double #000; padding: 25px; border-radius: 12px; max-width: 450px; margin: 0 auto; }
            h2 { font-size: 24px; margin-top: 0; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 8px; text-transform: uppercase; }
            .row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
            .footer { font-size: 11px; margin-top: 25px; color: #555; }
            .qr-code { margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="badge">
            <h2>Dyeing Run Ticket</h2>
            <div class="row"><strong>Run Batch ID:</strong> <span>${dye.dyeingId}</span></div>
            <div class="row"><strong>Lot Reference:</strong> <span>${dye.lotId}</span></div>
            <div class="row"><strong>Bag Barcode:</strong> <span>${dye.bagNo}</span></div>
            <div class="row"><strong>Client Party:</strong> <span>${dye.partyName}</span></div>
            <div class="row"><strong>Target Shade:</strong> <span>${dye.shade}</span></div>
            <div class="row"><strong>Recipe Code:</strong> <span>${dye.recipe || "Default formula"}</span></div>
            <div class="row"><strong>Machine No:</strong> <span>${dye.machine}</span></div>
            <div class="row"><strong>Weight In:</strong> <span>${dye.inputKg.toFixed(2)} Kg</span></div>
            <div class="row"><strong>Weight Out:</strong> <span>${dye.outputKg.toFixed(2)} Kg</span></div>
            <div class="row"><strong>Operator:</strong> <span>${dye.operatorName}</span></div>
            <div class="row"><strong>Current State:</strong> <span>${dye.status}</span></div>
            
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(dye.bagNo)}" alt="QR barcode label" />
            </div>
            <div class="footer">Hanks Production Line Management ERP System</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter listings
  const filteredDyeings = dyeings.filter((d) => {
    if (showSoftDeleted ? !d.isDeleted : d.isDeleted) return false;

    const term = search.toLowerCase();
    const matchesSearch =
      d.dyeingId.toLowerCase().includes(term) ||
      d.lotId.toLowerCase().includes(term) ||
      d.bagNo.toLowerCase().includes(term) ||
      d.partyName.toLowerCase().includes(term) ||
      d.shade.toLowerCase().includes(term) ||
      d.operatorName.toLowerCase().includes(term) ||
      d.machine.toLowerCase().includes(term);

    const matchesStatus = statusFilter === "all" ? true : d.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* 1. QR CODE SIMULATOR SCANNER TOP BAR */}
      <div className="bg-[#0e1633] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider block">
            Simulation Room: Barcode/QR Scanning Console
          </span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
          Auto-fetch order particulars with scanner. Type or paste any completed Hanks Bag sequence number (e.g., <span className="font-mono text-[#22d3ee]">L-001-B01</span>) or Lot Reference below to auto-fetch supplier details & weighed yarn feedstock metrics directly.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-bold text-slate-500">Scan Input Field</label>
            <div className="relative">
              <SearchCode className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Paste Bag Barcode..."
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleQRScan(scannedCode)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Find Code
          </button>
        </div>

        {/* Scan Results Panel */}
        {scanFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs animate-fadeIn ${
            scanFeedback.success ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <span className="font-semibold block">{scanFeedback.message}</span>
              {scanFeedback.details && (
                <div className="bg-[#0b122c]/60 p-3 rounded-lg border border-white/10 space-y-1.5 font-mono text-[11px] text-slate-300">
                  <div><strong>Lot ID:</strong> <span className="text-white">{scanFeedback.details.lotId}</span></div>
                  <div><strong>Bag Barcode:</strong> <span className="text-white">{scanFeedback.details.bagNo}</span></div>
                  <div><strong>Client Party:</strong> <span className="text-white">{scanFeedback.details.partyName}</span></div>
                  <div><strong>Feedstock Weight:</strong> <span className="text-cyan-400 font-bold">{scanFeedback.details.weight.toFixed(2)} Kg</span></div>
                </div>
              )}
              {scanFeedback.success && (
                <button
                  type="button"
                  onClick={applyScanAutofill}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3.5 rounded-lg text-[10px] uppercase tracking-wide transition-all cursor-pointer"
                >
                  Apply & Populate Forms
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Notifications Banner */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs animate-fadeIn ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* 2. LEDGER QUERY FILTERS & ACTIONS */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-[#0a1128]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          {/* Query search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, lot, bag, party, shade, machine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Status filtering dropdown */}
          <div className="relative w-full md:w-48 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="all">All statuses</option>
              {PRESET_STATUSES.map((st) => (
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
              className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0"
            />
            <span>Show Archived Tracks</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse"
            >
              <Plus className="w-4 h-4" />
              <span>Start Dyeing Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. DYEING BATCHES DATA TABLE */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Dye Run ID</th>
                <th className="py-3 px-4 font-mono">Lot & Bag Link</th>
                <th className="py-3 px-4">Client Party Name</th>
                <th className="py-3 px-4 text-center">Shade Code</th>
                <th className="py-3 px-4">Recipe Summary</th>
                <th className="py-3 px-4">Machine Unit</th>
                <th className="py-3 px-4">Crew Run Staff</th>
                <th className="py-3 px-4 text-right">In Weight</th>
                <th className="py-3 px-4 text-right">Out Weight</th>
                <th className="py-3 px-4 text-right">Weight Loss</th>
                <th className="py-3 px-4">Run Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500 font-mono">
                    Syncing Dyeing Production telemetry realtime database...
                  </td>
                </tr>
              ) : filteredDyeings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500 italic">
                    No matching Dyeing Production batch runs recorded in master directory.
                  </td>
                </tr>
              ) : (
                filteredDyeings.map((d) => (
                  <tr key={d.dyeingId} className="hover:bg-white/[0.018] transition-colors">
                    <td className="py-3 px-4 font-mono text-indigo-400 font-extrabold">{d.dyeingId}</td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-400 text-[11px] space-y-0.5">
                        <div className="text-slate-300 font-bold">{d.bagNo}</div>
                        <div>Lot Ref: {d.lotId}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{d.partyName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono">
                        {d.shade}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[140px] truncate text-slate-400 italic" title={d.recipe}>
                      {d.recipe || "Default color run"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-teal-400">{d.machine}</td>
                    <td className="py-3 px-4 text-[11px]">
                      <div className="space-y-0.5">
                        <div><strong className="text-slate-500 font-normal">OP:</strong> {d.operatorName}</div>
                        <div><strong className="text-slate-500 font-normal">HLP:</strong> {d.helperName}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{d.inputKg.toFixed(2)} Kg</td>
                    <td className="py-3 px-4 text-right font-mono text-white font-bold">{d.outputKg.toFixed(2)} Kg</td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={`font-bold ${d.lossPercent > 10 ? "text-amber-400" : "text-slate-400"}`}>
                        {d.lossPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        d.status === "Completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        d.status === "Running" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse" :
                        d.status === "Rework" ? "bg-amber-500/10 text-amber-450 border-amber-500/20" :
                        d.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        "bg-slate-500/10 text-slate-400 border-white/10"
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingDyeing(d)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-slate-300 transition-colors cursor-pointer"
                          title="Full audit specs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => printSticker(d)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-indigo-400 transition-colors cursor-pointer"
                          title="Print color ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(d)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Edit batch attributes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveToggle(d)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                d.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={d.isDeleted ? "Recover item" : "Archive item"}
                            >
                              {d.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* 4. MAIN FORM POPUP MODAL (ADD & EDIT) */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                {editingDyeing ? `Edit Dyeing run specification [${editingDyeing.dyeingId}]` : "Record New Dyeing Production Run"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpenForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If there is scanned feedback available, let them click to populate quickly within modal */}
            {hanksProds.length === 0 && greyStocks.length === 0 ? (
              <div className="text-center p-6 bg-red-500/10 text-red-400 space-y-2 rounded-xl text-xs">
                <p>Dependency elements are missing. Make sure you register at least one Grey Stock lot or Hanks Production Bag first.</p>
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg text-white font-bold"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* Simulated Scan / Select Block */}
                <div className="bg-[#0f193d] border border-indigo-500/15 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">
                      Auto-Fetch Bag QR Data
                    </span>
                    <span className="text-[10px] italic text-slate-400">Scan code above to autofill details automatically</span>
                  </div>

                  {/* Manual search helper inside modal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-bold">Populate via Scanning code simulation</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. L-001-B01 or HP-0001"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQRScan((e.target as HTMLInputElement).value);
                            }
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                        />
                        <span className="text-[9px] text-slate-500 font-mono py-1">Press Enter</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-bold">Or Select Bag / Lot Reference Manually</label>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleQRScan(val);
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Choose existing Hanks Bag --</option>
                        {hanksProds.map((hp) => (
                          <option key={hp.productionId} value={hp.bagNo}>
                            {hp.bagNo} ({hp.process} - {hp.outputKg} Kg)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Form populated attributes indicators */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-slate-500">Lot ID</label>
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
                      <label className="text-[9px] uppercase tracking-widest text-slate-500">Bag Barcode</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. L-001-B01"
                        value={bagNo}
                        onChange={(e) => setBagNo(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-slate-500">Supplier/Party</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Reliance Jari"
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-slate-500">Input Yarn Feed (Kg)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 48.5"
                        value={inputKg}
                        onChange={(e) => setInputKg(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Grid 2: Color, Formulation & Machine Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Shade Color</label>
                    {shades.length > 0 ? (
                      <select
                        value={shade}
                        onChange={(e) => setShade(e.target.value)}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer text-white focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">-- Choose shade --</option>
                        {shades.map((sh) => (
                          <option key={sh.shadeId} value={sh.shadeCode} className="bg-[#0b122c]">
                            {sh.shadeCode} - {sh.shadeName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. Navy Blue #4"
                        value={shade}
                        onChange={(e) => setShade(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipe / Formula</label>
                    <input
                      type="text"
                      placeholder="e.g. REC-104-Acid"
                      value={recipe}
                      onChange={(e) => setRecipe(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dyeing Machine Asset</label>
                    {machines.length > 0 ? (
                      <select
                        value={machineCode}
                        onChange={(e) => setMachineCode(e.target.value)}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer text-white focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">-- Select Machine --</option>
                        {machines.map((m) => (
                          <option key={m.machineId} value={m.machineCode} className="bg-[#0b122c]">
                            {m.machineCode} - {m.machineName} ({m.capacity} Kg)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. MAC-10"
                        value={machineCode}
                        onChange={(e) => setMachineCode(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    )}
                  </div>
                </div>

                {/* Grid 3: Run Personnel & Outgoing Yarn Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                  {/* Operator */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Machine Operator</label>
                    <select
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Crew Operator --</option>
                      {workers.map((w) => (
                        <option key={w.workerId} value={w.workerId} className="bg-[#0b122c]">
                          {w.workerName} ({w.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Helper */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Assistant / Helper</label>
                    <select
                      value={helperId}
                      onChange={(e) => setHelperId(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Helper --</option>
                      {workers.map((w) => (
                        <option key={w.workerId} value={w.workerId} className="bg-[#0b122c]">
                          {w.workerName} ({w.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Output weight estimation and loss dynamics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Exit dyed weight (Kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="Enter actual exit weight e.g. 47.9"
                      value={outputKg}
                      onChange={(e) => setOutputKg(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dye House state progress</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white cursor-pointer"
                    >
                      {PRESET_STATUSES.map((st) => (
                        <option key={st} value={st} className="bg-[#0b122c]">{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* real-time calculation container */}
                {parseFloat(inputKg) > 0 && parseFloat(outputKg) >= 0 && (
                  <div className="flex items-center justify-between p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl font-mono text-[11px]">
                    <span className="text-slate-400">Moisture / Processing weight discrepancy loss:</span>
                    <span className={`font-bold text-xs ${
                      (parseFloat(inputKg) - parseFloat(outputKg)) < 0 ? "text-red-400" :
                      ((parseFloat(inputKg) - parseFloat(outputKg)) / parseFloat(inputKg)) * 100 > 10 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {(((parseFloat(inputKg) - parseFloat(outputKg)) / parseFloat(inputKg)) * 100).toFixed(2)} % Loss
                    </span>
                  </div>
                )}

                {/* submission row buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsOpenForm(false)}
                    className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
                  >
                    Save Dyeing Session
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. AUDIT INFO CARD VIEW POPUP */}
      {viewingDyeing && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 font-sans">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Box className="w-4 h-4 text-teal-400" />
                Dyeing Batch run Audit Details
              </h3>
              <button
                type="button"
                onClick={() => setViewingDyeing(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Run ID:</span>
                <span className="text-white font-bold">{viewingDyeing.dyeingId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Lot reference:</span>
                <span className="text-white">{viewingDyeing.lotId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Bag code barcode:</span>
                <span className="text-[#a5b4fc] font-bold">{viewingDyeing.bagNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Client entity/party:</span>
                <span className="text-white font-sans font-semibold">{viewingDyeing.partyName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Designated Shade:</span>
                <span className="text-cyan-400 font-semibold">{viewingDyeing.shade}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Formulation Recipe:</span>
                <span className="text-white italic">{viewingDyeing.recipe || "Default color formulation"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Dyeing Machine Unit:</span>
                <span className="text-teal-400 font-bold">{viewingDyeing.machine}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Operation Driver:</span>
                <span className="text-white font-sans font-semibold">{viewingDyeing.operatorName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Machine Assistant:</span>
                <span className="text-white font-sans font-semibold">{viewingDyeing.helperName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Yarn entry weight:</span>
                <span className="text-white">{viewingDyeing.inputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Yarn output weight:</span>
                <span className="text-white font-bold">{viewingDyeing.outputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Wastage weight shrinkage:</span>
                <span className="text-amber-400 font-bold">{viewingDyeing.lossPercent}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Processing Status:</span>
                <span className="text-white font-bold">{viewingDyeing.status}</span>
              </div>
            </div>

            {/* QR block code banner preview */}
            <div className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/10 rounded-xl font-sans">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&bgcolor=0b122c&color=ffffff&qzone=1&data=${encodeURIComponent(viewingDyeing.bagNo)}`}
                alt="Barcode QR Code"
                className="w-16 h-16 border border-white/10 rounded object-contain bg-slate-950 p-1"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1 block">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest font-mono">
                  Active Run Sticker Code
                </span>
                <span className="text-[11px] text-slate-300 font-mono font-bold block">{viewingDyeing.bagNo}</span>
                <button
                  type="button"
                  onClick={() => printSticker(viewingDyeing)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1.5 cursor-pointer mt-0.5"
                >
                  <Printer className="w-3 h-3" />
                  Print sticker label
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end font-sans">
              <button
                type="button"
                onClick={() => setViewingDyeing(null)}
                className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-5 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

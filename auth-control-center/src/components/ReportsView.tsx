import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { 
  Party, Item, WorkerMaster, HanksProduction, DyeingProduction, 
  ConningProduction, DispatchTransaction, PaymentCollection, 
  LedgerAdjustment, GreyStock, Machine
} from "../types";
import { 
  FileText, ArrowUpRight, ArrowDownLeft, Printer, Download, Search, 
  RefreshCw, TrendingUp, DollarSign, Scale, Layers2, Factory, Layers, Users,
  Calculator, ChevronRight, Filter, Calendar
} from "lucide-react";

interface ReportsViewProps {
  role: string;
}

type ReportTab = 
  | "Party" 
  | "Item" 
  | "Month" 
  | "Worker" 
  | "Machine" 
  | "Unit" 
  | "Dispatch" 
  | "Payment";

export const ReportsView: React.FC<ReportsViewProps> = ({ role }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>("Party");
  const [loading, setLoading] = useState(true);

  // States
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [workers, setWorkers] = useState<WorkerMaster[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [greys, setGreys] = useState<GreyStock[]>([]);
  const [hanks, setHanks] = useState<HanksProduction[]>([]);
  const [dyeing, setDyeing] = useState<DyeingProduction[]>([]);
  const [conning, setConning] = useState<ConningProduction[]>([]);
  const [dispatches, setDispatches] = useState<DispatchTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentCollection[]>([]);
  const [adjustments, setAdjustments] = useState<LedgerAdjustment[]>([]);

  // Search parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const formatFirebaseDate = (dateTime: any) => {
    if (!dateTime) return "N/A";
    if (dateTime.seconds) {
      return new Date(dateTime.seconds * 1000).toISOString().split("T")[0];
    }
    if (dateTime instanceof Date) {
      return dateTime.toISOString().split("T")[0];
    }
    return String(dateTime);
  };

  useEffect(() => {
    setLoading(true);
    const unsubParties = onSnapshot(collection(db, "parties"), (snap) => {
      const list: Party[] = [];
      snap.forEach(d => {
        const item = d.data() as Party;
        if (!item.isDeleted) list.push(item);
      });
      setParties(list);
    });

    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      const list: Item[] = [];
      snap.forEach(d => {
        const item = d.data() as Item;
        if (!item.isDeleted) list.push(item);
      });
      setItems(list);
    });

    const unsubWorkers = onSnapshot(collection(db, "worker_masters"), (snap) => {
      const list: WorkerMaster[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerMaster;
        if (!item.isDeleted) list.push(item);
      });
      setWorkers(list);
    });

    const unsubMachines = onSnapshot(collection(db, "machines"), (snap) => {
      const list: Machine[] = [];
      snap.forEach(d => {
        const item = d.data() as Machine;
        if (!item.isDeleted) list.push(item);
      });
      setMachines(list);
    });

    const unsubGreys = onSnapshot(collection(db, "grey_stocks"), (snap) => {
      const list: GreyStock[] = [];
      snap.forEach(d => {
        const item = d.data() as GreyStock;
        if (!item.isDeleted) list.push(item);
      });
      setGreys(list);
    });

    const unsubHanks = onSnapshot(collection(db, "hanks_productions"), (snap) => {
      const list: HanksProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as HanksProduction;
        if (!item.isDeleted) list.push(item);
      });
      setHanks(list);
    });

    const unsubDyeing = onSnapshot(collection(db, "dyeing_productions"), (snap) => {
      const list: DyeingProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as DyeingProduction;
        if (!item.isDeleted) list.push(item);
      });
      setDyeing(list);
    });

    const unsubConning = onSnapshot(collection(db, "conning_productions"), (snap) => {
      const list: ConningProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as ConningProduction;
        if (!item.isDeleted) list.push(item);
      });
      setConning(list);
    });

    const unsubDisp = onSnapshot(collection(db, "dispatches"), (snap) => {
      const list: DispatchTransaction[] = [];
      snap.forEach(d => {
        const item = d.data() as DispatchTransaction;
        if (!item.isDeleted) list.push(item);
      });
      list.sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setDispatches(list);
    });

    const unsubPays = onSnapshot(collection(db, "payment_collections"), (snap) => {
      const list: PaymentCollection[] = [];
      snap.forEach(d => {
        const item = d.data() as PaymentCollection;
        if (!item.isDeleted) list.push(item);
      });
      list.sort((a,b) => b.paymentDate.localeCompare(a.paymentDate));
      setPayments(list);
    });

    const unsubAdjs = onSnapshot(collection(db, "ledger_adjustments"), (snap) => {
      const list: LedgerAdjustment[] = [];
      snap.forEach(d => {
        const item = d.data() as LedgerAdjustment;
        if (!item.isDeleted) list.push(item);
      });
      setAdjustments(list);
      setLoading(false);
    });

    return () => {
      unsubParties();
      unsubItems();
      unsubWorkers();
      unsubMachines();
      unsubGreys();
      unsubHanks();
      unsubDyeing();
      unsubConning();
      unsubDisp();
      unsubPays();
      unsubAdjs();
    };
  }, []);

  // Filter helper
  const dateWithinRange = (dateStr: string) => {
    if (!dateStr) return true;
    if (filterStartDate && dateStr < filterStartDate) return false;
    if (filterEndDate && dateStr > filterEndDate) return false;
    return true;
  };

  // 1. Compile Party Wise Report Dataset
  const getPartyWiseReport = () => {
    return parties.map(p => {
      const partyGreys = greys.filter(g => g.partyId === p.partyId && dateWithinRange(g.date));
      const totalGreyKg = partyGreys.reduce((sum, g) => sum + g.receivedQtyKg, 0);

      const partyDispatches = dispatches.filter(d => d.partyId === p.partyId && dateWithinRange(formatFirebaseDate(d.createdAt)));
      const totalDispatchKg = partyDispatches.reduce((sum, d) => sum + d.dispatchKg, 0);
      const totalInvoicedAmt = partyDispatches.reduce((sum, d) => sum + d.amount, 0);

      const partyPayments = payments.filter(pay => pay.partyId === p.partyId && dateWithinRange(pay.paymentDate));
      const totalCollectedAmt = partyPayments.reduce((sum, pay) => sum + pay.amount, 0);

      const partyAdjs = adjustments.filter(adj => adj.partyId === p.partyId && dateWithinRange(adj.date));
      const netAdjustment = partyAdjs.reduce((sum, adj) => {
        if (adj.type === "Debit") return sum + adj.amount; // owes factory more
        return sum - adj.amount; // owes factory less
      }, 0);

      const closingOutstanding = totalInvoicedAmt + netAdjustment - totalCollectedAmt;

      return {
        partyId: p.partyId,
        partyName: p.partyName,
        city: p.city || "Gujarat",
        totalGreyKg,
        totalDispatchKg,
        totalInvoicedAmt,
        totalCollectedAmt,
        closingOutstanding
      };
    }).filter(row => {
      if (!searchQuery) return true;
      return row.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             row.city.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // 2. Compile Item Wise Report Dataset
  const getItemWiseReport = () => {
    return items.map(it => {
      const itemDispatches = dispatches.filter(d => 
        (d.itemName.toLowerCase().includes(it.itemName.toLowerCase()) || d.itemName.toLowerCase().includes(it.itemCode.toLowerCase()))
        && dateWithinRange(formatFirebaseDate(d.createdAt))
      );
      const totalDispatchKg = itemDispatches.reduce((sum, d) => sum + d.dispatchKg, 0);
      const totalBilling = itemDispatches.reduce((sum, d) => sum + d.amount, 0);

      return {
        itemId: it.itemId,
        itemName: it.itemName,
        itemCode: it.itemCode,
        unit: it.unit || "Kg",
        totalDispatchKg,
        totalBilling
      };
    }).filter(row => {
      if (!searchQuery) return true;
      return row.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
             row.itemCode.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // 3. Compile Month Wise Report Dataset
  const getMonthWiseReport = () => {
    const monthlyGroups: Record<string, {
      monthKey: string;
      greyReceivedKg: number;
      dispatchedKg: number;
      billingValue: number;
      collections: number;
    }> = {};

    // Group dispatches
    dispatches.forEach(d => {
      const date = formatFirebaseDate(d.createdAt);
      if (!dateWithinRange(date)) return;
      const parsedMonth = date.substring(0, 7); // e.g. "2026-05"
      if (!monthlyGroups[parsedMonth]) {
        monthlyGroups[parsedMonth] = { monthKey: parsedMonth, greyReceivedKg: 0, dispatchedKg: 0, billingValue: 0, collections: 0 };
      }
      monthlyGroups[parsedMonth].dispatchedKg += d.dispatchKg;
      monthlyGroups[parsedMonth].billingValue += d.amount;
    });

    // Group grey inputs
    greys.forEach(g => {
      if (!dateWithinRange(g.date)) return;
      const parsedMonth = g.date.substring(0, 7);
      if (!monthlyGroups[parsedMonth]) {
        monthlyGroups[parsedMonth] = { monthKey: parsedMonth, greyReceivedKg: 0, dispatchedKg: 0, billingValue: 0, collections: 0 };
      }
      monthlyGroups[parsedMonth].greyReceivedKg += g.receivedQtyKg;
    });

    // Group payments collections
    payments.forEach(p => {
      if (!dateWithinRange(p.paymentDate)) return;
      const parsedMonth = p.paymentDate.substring(0,7);
      if (!monthlyGroups[parsedMonth]) {
        monthlyGroups[parsedMonth] = { monthKey: parsedMonth, greyReceivedKg: 0, dispatchedKg: 0, billingValue: 0, collections: 0 };
      }
      monthlyGroups[parsedMonth].collections += p.amount;
    });

    const dataset = Object.values(monthlyGroups);
    dataset.sort((a,b) => b.monthKey.localeCompare(a.monthKey));
    return dataset.filter(row => {
      if (!searchQuery) return true;
      return row.monthKey.includes(searchQuery);
    });
  };

  // 4. Compile Worker Wise Report
  const getWorkerWiseReport = () => {
    return workers.map(w => {
      const workerHanks = hanks.filter(h => h.workerId === w.workerId && dateWithinRange(formatFirebaseDate(h.createdAt)));
      const hanksTotalKg = workerHanks.reduce((sum, h) => sum + (h.outputKg || 0), 0);

      const workerDyeing = dyeing.filter(d => (d.operatorId === w.workerId || d.helperId === w.workerId) && dateWithinRange(formatFirebaseDate(d.createdAt)));
      const dyeingTotalBatches = workerDyeing.length;

      // Filter conning winders
      const totalWindCones = conning.filter(c => dateWithinRange(formatFirebaseDate(c.createdAt))).reduce((sum, c) => sum + c.conesCount, 0);

      return {
        workerId: w.workerId,
        workerName: w.workerName,
        unit: w.unit || "N/A",
        role: w.role || "Operator",
        hanksTotalKg,
        dyeingTotalBatches
      };
    }).filter(row => {
      if (!searchQuery) return true;
      return row.workerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
             row.role.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // 5. Machine Wise Production Report
  const getMachineWiseReport = () => {
    const machineGroups: Record<string, {
      machineId: string;
      machineName: string;
      totalBatches: number;
      totalWeightProcessedKg: number;
    }> = {};

    machines.forEach(m => {
      machineGroups[m.machineName] = { 
        machineId: m.machineId, 
        machineName: m.machineName, 
        totalBatches: 0, 
        totalWeightProcessedKg: 0 
      };
    });

    dyeing.forEach(d => {
      if (!dateWithinRange(formatFirebaseDate(d.createdAt)) || d.isDeleted) return;
      const key = d.machine || "Machine Dynamic";
      if (!machineGroups[key]) {
        machineGroups[key] = { machineId: `M-${Date.now().toString().slice(-3)}`, machineName: key, totalBatches: 0, totalWeightProcessedKg: 0 };
      }
      machineGroups[key].totalBatches += 1;
      machineGroups[key].totalWeightProcessedKg += d.outputKg || d.inputKg || 0;
    });

    return Object.values(machineGroups).filter(row => {
      if (!searchQuery) return true;
      return row.machineName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // 6. Unit Wise Manufacturing Output
  const getUnitWiseReport = () => {
    const units = ["Unit 1", "Unit 2", "Unassigned"];
    return units.map(unitLabel => {
      const unitWorkers = workers.filter(w => (w.unit || "Unassigned").toLowerCase().includes(unitLabel.toLowerCase()));
      const workerIds = unitWorkers.map(w => w.workerId);

      const unitHanks = hanks.filter(h => workerIds.includes(h.workerId) && dateWithinRange(formatFirebaseDate(h.createdAt)));
      const hanksWeight = unitHanks.reduce((sum, h) => sum + h.outputKg, 0);

      const unitDyeing = dyeing.filter(d => (workerIds.includes(d.operatorId) || workerIds.includes(d.helperId)) && dateWithinRange(formatFirebaseDate(d.createdAt)));
      const dyeingWeight = unitDyeing.reduce((sum, d) => sum + d.outputKg, 0);

      return {
        unitName: unitLabel,
        activeStaffCount: unitWorkers.length,
        hanksWeightProcessedKg: hanksWeight,
        dyeingWeightProcessedKg: dyeingWeight
      };
    });
  };

  // 7. Dispatches Ledger
  const getFilteredDispatches = () => {
    return dispatches.filter(d => {
      const inDate = dateWithinRange(formatFirebaseDate(d.createdAt));
      const inQuery = !searchQuery || 
        d.partyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.lrNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase());
      return inDate && inQuery;
    });
  };

  // 8. Payment Ledger
  const getFilteredPayments = () => {
    return payments.filter(p => {
      const inDate = dateWithinRange(p.paymentDate);
      const inQuery = !searchQuery || 
        p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());
      return inDate && inQuery;
    });
  };

  // CSV Exporter logic - generates beautiful formatted spreadsheet files in client browser (Excel friendly)
  const handleCSVExport = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `Report_${activeTab}_Export.csv`;

    if (activeTab === "Party") {
      headers = ["Party ID", "Party Name", "Billing Location", "Received Grey (Kg)", "Dispatched Finished (Kg)", "Invoiced Value (₹)", "Revenues Cleared (₹)", "Closing Outstanding Balance (₹)"];
      rows = getPartyWiseReport().map(row => [
        row.partyId, row.partyName, row.city,
        row.totalGreyKg.toString(), row.totalDispatchKg.toString(),
        row.totalInvoicedAmt.toString(), row.totalCollectedAmt.toString(), row.closingOutstanding.toString()
      ]);
      filename = `PartyWise_Outstanding_Audit.csv`;
    } 
    else if (activeTab === "Item") {
      headers = ["Item ID", "Item Descriptor", "Standard Code", "Units", "Dispatched Out weight (Kg)", "Generated Billing Value (₹)"];
      rows = getItemWiseReport().map(row => [
        row.itemId, row.itemName, row.itemCode, row.unit,
        row.totalDispatchKg.toString(), row.totalBilling.toString()
      ]);
      filename = `ItemWise_Billing_Production.csv`;
    } 
    else if (activeTab === "Month") {
      headers = ["Chronology Month", "Total Received Grey (Kg)", "Dispatched Out Weight (Kg)", "Invoiced Billing value (₹)", "Net Receipts In (₹)"];
      rows = getMonthWiseReport().map(row => [
        row.monthKey, row.greyReceivedKg.toString(), row.dispatchedKg.toString(),
        row.billingValue.toString(), row.collections.toString()
      ]);
      filename = `MonthWise_Growth_Aggregates.csv`;
    } 
    else if (activeTab === "Worker") {
      headers = ["Worker ID", "Staff Name", "Workplace Unit", "Predefined role", "Approved Hanks Weight (Kg)", "Dyeing Batches Processed"];
      rows = getWorkerWiseReport().map(row => [
        row.workerId, row.workerName, row.unit, row.role,
        row.hanksTotalKg.toString(), row.dyeingTotalBatches.toString()
      ]);
      filename = `WorkerWise_Output_Audit.csv`;
    } 
    else if (activeTab === "Machine") {
      headers = ["Machine Code", "Machine Identifier Name", "Total Batches Run", "Aggregate processed volume (Kg)"];
      rows = getMachineWiseReport().map(row => [
        row.machineId, row.machineName, row.totalBatches.toString(), row.totalWeightProcessedKg.toString()
      ]);
      filename = `MachineWise_Load_Capacity.csv`;
    } 
    else if (activeTab === "Unit") {
      headers = ["Workplace Unit Name", "Staff Active count", "Hanks Processed (Kg)", "Dyeing Processed (Kg)"];
      rows = getUnitWiseReport().map(row => [
        row.unitName, row.activeStaffCount.toString(), row.hanksWeightProcessedKg.toString(), row.dyeingWeightProcessedKg.toString()
      ]);
      filename = `UnitWise_Productivity_Out.csv`;
    } 
    else if (activeTab === "Dispatch") {
      headers = ["Post Date", "Invoice No", "Customer Party", "Yarn Descriptor", "Color shade", "Dispatched Weight (Kg)", "Billed Rate (₹/Kg)", "Total Value (₹)", "LR Transport No", "Vehicle Carrier No"];
      rows = getFilteredDispatches().map(row => [
        formatFirebaseDate(row.createdAt), row.invoiceNo, row.partyName, row.itemName, row.shade,
        row.dispatchKg.toString(), row.rate.toString(), row.amount.toString(), row.lrNo, row.vehicleNo
      ]);
      filename = `DispatchLine_Shipments_Log.csv`;
    } 
    else if (activeTab === "Payment") {
      headers = ["Clearing Date", "Customer Party", "Receipt Mode", "Reference Transaction ID", "Amount Collected (₹)", "Audit note remarks"];
      rows = getFilteredPayments().map(row => [
        row.paymentDate, row.partyName, row.mode, row.referenceNo,
        row.amount.toString(), row.notes
      ]);
      filename = `PaymentsReceived_Ledger_Log.csv`;
    }

    // Format CSV
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(x => `"${x.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="master-reports-viewport">
      
      {/* Parameters Selector Card */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1.5">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">ERP High-Fidelity Audit Report Studio</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2.5 py-1 rounded-lg border border-indigo-500/15 uppercase tracking-wider font-sans">
              Reports Live Sync
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs font-sans text-slate-300">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">From boundary Date</label>
            <input 
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">To boundary Date</label>
            <input 
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none font-sans"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Search and Filter Keyword</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search Client name, Invoice ID, transport LR, machine name, workers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation list */}
      <div className="flex border-b border-white/10 gap-2 print:hidden scrollbar-none overflow-x-auto">
        {(["Party", "Item", "Month", "Worker", "Machine", "Unit", "Dispatch", "Payment"] as ReportTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSearchQuery("");
            }}
            className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === tab 
                ? "border-indigo-500 text-white bg-slate-900/40" 
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {tab} Reports
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-slate-900 hover:bg-slate-800 border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" />
          Export PDF
        </button>
        <button
          onClick={handleCSVExport}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md"
        >
          <Download className="w-3.5 h-3.5" />
          Excel / CSV Download
        </button>
      </div>

      {/* ===================== TAB 1: PARTY WISE OUTSTANDING REPORT ===================== */}
      {activeTab === "Party" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Party Wise Financial Ledger Balance Summary</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Row items Count: {getPartyWiseReport().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-401 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-3">Party ID</th>
                  <th className="py-2.5 px-2">Party Name</th>
                  <th className="py-2.5 px-2">Location</th>
                  <th className="py-2.5 px-2 text-right">Received Grey (Kg)</th>
                  <th className="py-2.5 px-2 text-right">Dispatched (Kg)</th>
                  <th className="py-2.5 px-2 text-right text-indigo-400">Total Billed (₹)</th>
                  <th className="py-2.5 px-2 text-right text-emerald-400">Total Cleared (₹)</th>
                  <th className="py-2.5 px-3 text-right pr-6 text-rose-400">Outstanding Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getPartyWiseReport().length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">No matching financial records found. Try modifying boundaries and keywords.</td>
                  </tr>
                ) : (
                  getPartyWiseReport().map(row => (
                    <tr key={row.partyId} className="hover:bg-white/[0.015]">
                      <td className="py-3 px-3 text-cyan-400 font-bold">{row.partyId}</td>
                      <td className="py-3 px-2 font-sans font-extrabold text-white text-sm uppercase">{row.partyName}</td>
                      <td className="py-3 px-2 font-sans text-slate-400">{row.city}</td>
                      <td className="py-3 px-2 text-right">{row.totalGreyKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3 px-2 text-right">{row.totalDispatchKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3 px-2 text-right text-indigo-305 text-indigo-400 font-bold">₹{row.totalInvoicedAmt.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-emerald-450 text-emerald-400 font-bold">₹{row.totalCollectedAmt.toLocaleString()}</td>
                      <td className={`py-3 px-3 text-right pr-6 font-black ${row.closingOutstanding > 5000 ? "text-rose-400" : "text-emerald-400"}`}>
                        ₹{row.closingOutstanding.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: ITEM WISE METRIC REPORT ===================== */}
      {activeTab === "Item" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Product Item Processing Output & Billing Roster</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Items: {getItemWiseReport().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Item ID</th>
                  <th className="py-2.5 px-2">Catalog descriptor</th>
                  <th className="py-2.5 px-2 text-center">Item Code</th>
                  <th className="py-2.5 px-2 text-center">Unit Type</th>
                  <th className="py-2.5 px-2 text-right">Dispatched weight out</th>
                  <th className="py-2.5 px-4 text-right pr-8 text-indigo-400">Total Billed Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getItemWiseReport().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">No matching items resolved. Ensure items database exists.</td>
                  </tr>
                ) : (
                  getItemWiseReport().map(row => (
                    <tr key={row.itemId} className="hover:bg-white/[0.01]">
                      <td className="py-3.5 px-4 text-cyan-400 font-bold">{row.itemId}</td>
                      <td className="py-3.5 px-2 font-sans font-extrabold text-white uppercase">{row.itemName}</td>
                      <td className="py-3.5 px-2 text-center font-bold">{row.itemCode}</td>
                      <td className="py-3.5 px-2 text-center font-sans text-slate-400 uppercase">{row.unit}</td>
                      <td className="py-3.5 px-2 text-right font-black text-white">{row.totalDispatchKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3.5 px-4 text-right pr-8 font-black text-indigo-400">₹{row.totalBilling.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: MONTHLY BUSINESS COMPILER ===================== */}
      {activeTab === "Month" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Monthly Output, Billing & Collection Aggregates</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Record months: {getMonthWiseReport().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Calendar Month</th>
                  <th className="py-2.5 px-2 text-right">Raw material received</th>
                  <th className="py-2.5 px-2 text-right">Finished Dispatched weight</th>
                  <th className="py-2.5 px-2 text-right text-indigo-400">Total Billed billing (₹)</th>
                  <th className="py-2.5 px-4 text-right pr-8 text-emerald-400">Receipts In (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getMonthWiseReport().length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">No monthly chronologies recovered. Ensure Dispatches and Stocks are loaded.</td>
                  </tr>
                ) : (
                  getMonthWiseReport().map(row => (
                    <tr key={row.monthKey} className="hover:bg-white/[0.01]">
                      <td className="py-3.5 px-4 text-cyan-400 font-bold font-sans text-sm">{row.monthKey}</td>
                      <td className="py-3.5 px-2 text-right text-slate-300">{row.greyReceivedKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3.5 px-2 text-right text-white font-extrabold">{row.dispatchedKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3.5 px-2 text-right text-indigo-400 font-extrabold">₹{row.billingValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td className="py-3.5 px-4 text-right pr-8 text-emerald-400 font-black">₹{row.collections.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: WORKER PERFORMANCE OUTPUTS ===================== */}
      {activeTab === "Worker" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Staff Productivity, Output & Machine Assignments</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Staff active count: {getWorkerWiseReport().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-2">Workforce Name</th>
                  <th className="py-2.5 px-2">Assigned Unit</th>
                  <th className="py-2.5 px-2">Roster role</th>
                  <th className="py-2.5 px-2 text-right">Hanks weight output</th>
                  <th className="py-2.5 px-4 text-right pr-8">Dyeing Batches Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getWorkerWiseReport().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">No staff roster registers found. Ensure Worker Master catalog has items.</td>
                  </tr>
                ) : (
                  getWorkerWiseReport().map(row => (
                    <tr key={row.workerId} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-4 text-cyan-400 font-bold">{row.workerId}</td>
                      <td className="py-3 px-2 font-sans font-extrabold text-white text-sm uppercase">{row.workerName}</td>
                      <td className="py-3 px-2 font-sans text-slate-400">Unit {row.unit}</td>
                      <td className="py-3 px-2 font-sans text-slate-400 uppercase tracking-widest text-[10px]">{row.role}</td>
                      <td className="py-3 px-2 text-right font-black text-indigo-400">{row.hanksTotalKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                      <td className="py-3 px-4 text-right pr-8 font-black text-amber-500">{row.dyeingTotalBatches} Lots run</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 5: MACHINE PERFORMANCE AUDITS ===================== */}
      {activeTab === "Machine" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Machine Wise Production volume and Running Batches</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Operating Machine Assets: {getMachineWiseReport().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Asset ID</th>
                  <th className="py-2.5 px-2">Machine Identifier Label</th>
                  <th className="py-2.5 px-2 text-center">Completed Lots</th>
                  <th className="py-2.5 px-4 text-right pr-8 text-indigo-400 font-bold">Total Physical output weight resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getMachineWiseReport().length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 font-sans">No matching machine records generated from processing history.</td>
                  </tr>
                ) : (
                  getMachineWiseReport().map(row => (
                    <tr key={row.machineId} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-4 text-cyan-400 font-bold">{row.machineId}</td>
                      <td className="py-3 px-2 font-sans font-extrabold text-white text-sm uppercase">{row.machineName}</td>
                      <td className="py-3 px-2 text-center text-amber-400 font-bold text-sm">{row.totalBatches} runs</td>
                      <td className="py-3 px-4 text-right pr-8 font-black text-indigo-400">{row.totalWeightProcessedKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg processed</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 6: UNIT WISE OPERATIONS SPLIT ===================== */}
      {activeTab === "Unit" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Manufacturing Units Operating Capacity Splits</span>
            <span className="text-[10px] text-slate-500">Unit Nodes Resolved: 3</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Manufacturing Workplace node</th>
                  <th className="py-2.5 px-2 text-center">Workforce Count</th>
                  <th className="py-2.5 px-2 text-right">Approved Hanks Capacity load</th>
                  <th className="py-2.5 px-4 text-right pr-8 text-emerald-450 text-emerald-400">Operator Dye Weight volume out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getUnitWiseReport().map((row, index) => (
                  <tr key={index} className="hover:bg-white/[0.01]">
                    <td className="py-3.5 px-4 text-white font-extrabold font-sans text-sm">{row.unitName}</td>
                    <td className="py-3.5 px-2 text-center font-bold text-cyan-400 font-sans">{row.activeStaffCount} active members</td>
                    <td className="py-3.5 px-2 text-right">{row.hanksWeightProcessedKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                    <td className="py-3.5 px-4 text-right pr-8 font-black text-emerald-450 text-emerald-400">{row.dyeingWeightProcessedKg.toLocaleString(undefined, {maximumFractionDigits: 2})} Kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 7: DISPATCH DETAILED LOGS ===================== */}
      {activeTab === "Dispatch" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Fulfillment Dispatch Transactions Logs</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Transferred rows: {getFilteredDispatches().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-2 text-center">Invoice ID</th>
                  <th className="py-2.5 px-2">Customer Client</th>
                  <th className="py-2.5 px-2">Yarn Descriptor</th>
                  <th className="py-2.5 px-2 text-right">Dispatched Kg</th>
                  <th className="py-2.5 px-2 text-right">Billing Rate</th>
                  <th className="py-2.5 px-2 text-right text-indigo-400">Billed Total</th>
                  <th className="py-2.5 px-3 text-right pr-4">Carrier Transports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getFilteredDispatches().length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">No matching dispatches recorded in period. Check dates.</td>
                  </tr>
                ) : (
                  getFilteredDispatches().map(row => (
                    <tr key={row.dispatchId} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-3 font-sans max-w-[80px] truncate">{formatFirebaseDate(row.createdAt)}</td>
                      <td className="py-3 px-2 text-center text-cyan-400 font-bold">{row.invoiceNo}</td>
                      <td className="py-3 px-2 font-sans font-extrabold text-white max-w-[120px] truncate uppercase">{row.partyName}</td>
                      <td className="py-3 px-2 font-sans text-slate-400 max-w-[125px] truncate">{row.itemName} ({row.shade})</td>
                      <td className="py-3 px-2 text-right text-white font-extrabold">{row.dispatchKg.toLocaleString()} Kg</td>
                      <td className="py-3 px-2 text-right">₹{row.rate.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-black text-indigo-450 text-indigo-400 font-bold">₹{row.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right pr-4 font-sans text-slate-500 text-[10px] max-w-[140px] truncate">
                        LR: {row.lrNo} | {row.vehicleNo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 8: PAYMENT INCOMING RECEIPTS ===================== */}
      {activeTab === "Payment" && (
        <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans p-2">
          <div className="p-4 border-b border-white/5 font-bold text-white uppercase tracking-wider flex justify-between items-center bg-white/[0.01]">
            <span>Payment Receipts clearing log database</span>
            <span className="text-[10px] font-mono font-normal text-slate-500">Collected events: {getFilteredPayments().length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[9px] tracking-wider bg-white/[0.02]">
                  <th className="py-2.5 px-4">Post date</th>
                  <th className="py-2.5 px-2">Paying Party</th>
                  <th className="py-2.5 px-2">Clearing route</th>
                  <th className="py-2.5 px-2">Transaction Ref No</th>
                  <th className="py-2.5 px-3 text-right pr-8 text-emerald-400">Cleared Amount</th>
                  <th className="py-2.5 px-2 pr-4 text-slate-500">Audit details description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-350 font-mono">
                {getFilteredPayments().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">No inward payment receipts found matching selected criteria.</td>
                  </tr>
                ) : (
                  getFilteredPayments().map(row => (
                    <tr key={row.paymentId} className="hover:bg-white/[0.01]">
                      <td className="py-3.5 px-4 text-slate-400 font-sans">{row.paymentDate}</td>
                      <td className="py-3.5 px-2 font-sans font-extrabold text-white uppercase text-sm">{row.partyName}</td>
                      <td className="py-3.5 px-2 text-white font-sans text-xs uppercase font-bold">{row.mode}</td>
                      <td className="py-3.5 px-2 font-bold max-w-[120px] truncate" title={row.referenceNo}>{row.referenceNo}</td>
                      <td className="py-3.5 px-3 text-right pr-8 font-black text-emerald-450 text-emerald-400">₹{row.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="py-3.5 px-2 font-sans text-slate-500 max-w-[160px] truncate" title={row.notes}>{row.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

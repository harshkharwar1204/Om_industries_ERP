import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { PaymentCollection, Party, DispatchTransaction, LedgerAdjustment, OperationType } from "../types";
import { 
  Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Search, Printer, 
  ArrowUpRight, ArrowDownLeft, X, FileText, Check, AlertCircle, RefreshCw, User, Filter, Calendar
} from "lucide-react";

interface FinanceViewProps {
  role: string;
}

type FinanceTab = "Payments" | "Ledger" | "Adjustments";

export const FinanceView: React.FC<FinanceViewProps> = ({ role }) => {
  const [activeTab, setActiveTab] = useState<FinanceTab>("Payments");
  const [parties, setParties] = useState<Party[]>([]);
  const [payments, setPayments] = useState<PaymentCollection[]>([]);
  const [dispatches, setDispatches] = useState<DispatchTransaction[]>([]);
  const [adjustments, setAdjustments] = useState<LedgerAdjustment[]>([]);

  // Loading & alerts
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form toggles
  const [isOpenPaymentForm, setIsOpenPaymentForm] = useState(false);
  const [isOpenAdjustmentForm, setIsOpenAdjustmentForm] = useState(false);

  // Payment creation fields
  const [payPartyId, setPayPartyId] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"Cash" | "UPI" | "Bank Transfer" | "Cheque">("Cash");
  const [payRefNo, setPayRefNo] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Adjustment creation fields
  const [adjPartyId, setAdjPartyId] = useState("");
  const [adjDate, setAdjDate] = useState("");
  const [adjType, setAdjType] = useState<"Debit" | "Credit">("Debit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjParticulars, setAdjParticulars] = useState("");

  // Search & Filter
  const [searchPay, setSearchPay] = useState("");
  const [filterPartyPay, setFilterPartyPay] = useState("all");
  
  // Ledger selected party
  const [ledgerPartyId, setLedgerPartyId] = useState("");
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");

  const isStaff = role === "owner" || role === "manager";

  // Load Firestore data
  useEffect(() => {
    setLoading(true);

    // 1. Parties
    const unsubscribeParties = onSnapshot(
      collection(db, "parties"),
      (snap) => {
        const list: Party[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Party;
          if (!data.isDeleted) list.push(data);
        });
        setParties(list);
        if (list.length > 0 && !ledgerPartyId) {
          setLedgerPartyId(list[0].partyId);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "parties")
    );

    // 2. Payment Collections
    const unsubscribePayments = onSnapshot(
      collection(db, "payment_collections"),
      (snap) => {
        const list: PaymentCollection[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as PaymentCollection);
        });
        list.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
        setPayments(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "payment_collections");
      }
    );

    // 3. Dispatches (for dynamic ledger calculations as Debit side)
    const unsubscribeDispatches = onSnapshot(
      collection(db, "dispatches"),
      (snap) => {
        const list: DispatchTransaction[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as DispatchTransaction);
        });
        setDispatches(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "dispatches")
    );

    // 4. Ledger adjustments
    const unsubscribeAdjustments = onSnapshot(
      collection(db, "ledger_adjustments"),
      (snap) => {
        const list: LedgerAdjustment[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as LedgerAdjustment);
        });
        setAdjustments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "ledger_adjustments")
    );

    return () => {
      unsubscribeParties();
      unsubscribePayments();
      unsubscribeDispatches();
      unsubscribeAdjustments();
    };
  }, []);

  // Format today's date for defaults
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const handleOpenPaymentForm = () => {
    setPayPartyId("");
    setPayDate(getTodayDate());
    setPayAmount("");
    setPayMode("Cash");
    setPayRefNo("");
    setPayNotes("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpenPaymentForm(true);
  };

  const handleOpenAdjustmentForm = () => {
    setAdjPartyId("");
    setAdjDate(getTodayDate());
    setAdjType("Debit");
    setAdjAmount("");
    setAdjParticulars("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpenAdjustmentForm(true);
  };

  // Submit Payment Collection
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPartyId || !payAmount || !payDate) {
      setErrorMsg("Please complete all required fields (*).");
      return;
    }

    const value = parseFloat(payAmount);
    if (isNaN(value) || value <= 0) {
      setErrorMsg("Payment amount must be a valid positive number.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const selectedParty = parties.find(p => p.partyId === payPartyId);

    const nextIdVal = payments.length > 0 
      ? `COLL-${("000" + (Math.max(...payments.map(p => {
          const m = p.paymentId.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        })) + 1)).slice(-4)}`
      : "COLL-0001";

    const newPayment: PaymentCollection = {
      paymentId: nextIdVal,
      partyId: payPartyId,
      partyName: selectedParty?.partyName || "Unknown Party",
      paymentDate: payDate,
      mode: payMode,
      referenceNo: payRefNo || "Ref-None",
      amount: value,
      notes: payNotes || "Standard Account Receipt",
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "payment_collections", nextIdVal), newPayment);
      setSuccessMsg(`Payment receipt ${nextIdVal} of ₹${value.toLocaleString()} successfully recorded!`);
      setIsOpenPaymentForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to store payment receipt: " + err.message);
    }
  };

  // Submit Journal Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjPartyId || !adjAmount || !adjDate || !adjParticulars) {
      setErrorMsg("Please fill in all requested fields.");
      return;
    }

    const value = parseFloat(adjAmount);
    if (isNaN(value) || value <= 0) {
      setErrorMsg("Adjustment amount must be positive.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const selectedParty = parties.find(p => p.partyId === adjPartyId);
    const nextIdVal = adjustments.length > 0
      ? `ADJ-${("000" + (Math.max(...adjustments.map(a => {
          const m = a.adjustmentId.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        })) + 1)).slice(-4)}`
      : "ADJ-0001";

    const newAdjustment: LedgerAdjustment = {
      adjustmentId: nextIdVal,
      partyId: adjPartyId,
      partyName: selectedParty?.partyName || "Unknown Party",
      date: adjDate,
      type: adjType,
      particulars: adjParticulars,
      amount: value,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "ledger_adjustments", nextIdVal), newAdjustment);
      setSuccessMsg(`Journal Voucher adjustment ${nextIdVal} completed successfully.`);
      setIsOpenAdjustmentForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to log voucher adjustment: " + err.message);
    }
  };

  // Delete Voucher
  const handleDeletePayment = async (payId: string) => {
    if (!window.confirm("Are you sure you want to delete this payment record? This will alter active client balances.")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "payment_collections", payId), {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg("Payment receipt marked as deleted.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Deletion failed: " + err.message);
    }
  };

  const handleDeleteAdjustment = async (adjId: string) => {
    if (!window.confirm("Are you sure you want to remove this journal voucher adjustment?")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "ledger_adjustments", adjId), {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg("Journal entry deleted.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Delection failed: " + err.message);
    }
  };

  // Filter Payments list
  const filteredPayments = payments.filter((p) => {
    if (p.isDeleted) return false;
    const matchesSearch = 
      p.paymentId.toLowerCase().includes(searchPay.toLowerCase()) ||
      p.partyName.toLowerCase().includes(searchPay.toLowerCase()) ||
      p.referenceNo.toLowerCase().includes(searchPay.toLowerCase());

    const matchesParty = filterPartyPay === "all" || p.partyId === filterPartyPay;
    return matchesSearch && matchesParty;
  });

  // LEDGER GENERATOR LOGIC
  // Collect all transactions for chosen Party, order chronologically, calculate running ledger balance.
  const generateLedgerLines = () => {
    if (!ledgerPartyId) return [];

    interface LedgerLine {
      id: string;
      date: string;
      docType: "Invoice/Dispatch" | "Payment Collection" | "Journal Debit Voucher" | "Journal Credit Voucher";
      particulars: string;
      debit: number;  // Increases what they owe us
      credit: number; // Decreases what they owe us
    }

    const lines: LedgerLine[] = [];

    // 1. Gather invoices (Dispatches with "Dispatched" status)
    dispatches.forEach((d) => {
      if (d.partyId === ledgerPartyId && !d.isDeleted && d.status === "Dispatched") {
        lines.push({
          id: d.invoiceNo,
          date: d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().split("T")[0] : getTodayDate(),
          docType: "Invoice/Dispatch",
          particulars: `${d.itemName} (Shade: ${d.shade || "N/A"}) - ${d.dispatchKg.toFixed(2)} Kg @ ₹${d.rate.toFixed(2)}`,
          debit: d.amount,
          credit: 0
        });
      }
    });

    // 2. Gather Payment Collections
    payments.forEach((p) => {
      if (p.partyId === ledgerPartyId && !p.isDeleted) {
        lines.push({
          id: p.paymentId,
          date: p.paymentDate,
          docType: "Payment Collection",
          particulars: `Received via ${p.mode} (Ref: ${p.referenceNo}) ${p.notes ? "- " + p.notes : ""}`,
          debit: 0,
          credit: p.amount
        });
      }
    });

    // 3. Gather manual adjustments
    adjustments.forEach((adj) => {
      if (adj.partyId === ledgerPartyId && !adj.isDeleted) {
        lines.push({
          id: adj.adjustmentId,
          date: adj.date,
          docType: adj.type === "Debit" ? "Journal Debit Voucher" : "Journal Credit Voucher",
          particulars: adj.particulars,
          debit: adj.type === "Debit" ? adj.amount : 0,
          credit: adj.type === "Credit" ? adj.amount : 0
        });
      }
    });

    // Sort chronologically
    lines.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    // Date filtering if applicable
    let filteredLines = lines;
    if (ledgerStartDate) {
      filteredLines = filteredLines.filter(line => line.date >= ledgerStartDate);
    }
    if (ledgerEndDate) {
      filteredLines = filteredLines.filter(line => line.date <= ledgerEndDate);
    }

    // Compute running balance
    let currentBal = 0;
    return filteredLines.map((line) => {
      currentBal += (line.debit - line.credit);
      return {
        ...line,
        runningBalance: currentBal
      };
    });
  };

  const ledgerLines = generateLedgerLines();
  const selectedLedgerPartyObj = parties.find(p => p.partyId === ledgerPartyId);

  // Totals for Ledger Tab
  const totalDebitsForSelectedParty = ledgerLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCreditsForSelectedParty = ledgerLines.reduce((sum, l) => sum + l.credit, 0);
  const closingBalanceForSelectedParty = totalDebitsForSelectedParty - totalCreditsForSelectedParty;

  // Global KPIs on payments
  const grossPaymentsCollected = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Alert Banners */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-xs animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-00 hover:text-white font-bold">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-xs animate-fadeIn">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white font-bold">&times;</button>
        </div>
      )}

      {/* Navigation Tabs bar */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveTab("Payments")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Payments" 
              ? "border-indigo-500 text-white bg-slate-900/30" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Payment Collections
        </button>
        <button
          onClick={() => setActiveTab("Ledger")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Ledger"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          Party Auditing Ledger
        </button>
        <button
          onClick={() => setActiveTab("Adjustments")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Adjustments"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Journal Vouchers
        </button>
      </div>

      {/* ==================== TAB 1: PAYMENT COLLECTIONS ==================== */}
      {activeTab === "Payments" && (
        <div className="space-y-6">
          
          {/* Quick Metrics display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Receipts Collected</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">₹{grossPaymentsCollected.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Collected today</span>
                <span className="text-2xl font-black text-white font-mono">
                  ₹{payments
                    .filter(p => !p.isDeleted && p.paymentDate === getTodayDate())
                    .reduce((sum, p) => sum + p.amount, 0).toLocaleString()
                  }
                </span>
              </div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <ArrowUpRight className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Receipt count</span>
                <span className="text-2xl font-black text-indigo-400 font-mono">{payments.filter(p => !p.isDeleted).length} <span className="text-xs font-sans text-slate-500">Receipts</span></span>
              </div>
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filtering Control Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search receipt ID, Party client name or Ref No..."
                  value={searchPay}
                  onChange={(e) => setSearchPay(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterPartyPay}
                  onChange={(e) => setFilterPartyPay(e.target.value)}
                  className="bg-slate-900 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Every Customer Party</option>
                  {parties.map((p) => (
                    <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
                  ))}
                </select>
              </div>
            </div>

            {isStaff && (
              <button
                onClick={handleOpenPaymentForm}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Record Cash/Bank Receipt
              </button>
            )}
          </div>

          {/* Payments Directory list */}
          <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 animate-pulse">Payment ID</th>
                    <th className="py-3.5 px-4">Party Client Name</th>
                    <th className="py-3.5 px-4">Receipt Date</th>
                    <th className="py-3.5 px-4">Payment Mode</th>
                    <th className="py-3.5 px-4">Reference No</th>
                    <th className="py-3.5 px-4 text-right pr-6">Amount Collected</th>
                    <th className="py-3.5 px-4 font-sans text-slate-400">Auditing Notes</th>
                    {isStaff && <th className="py-3.5 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-7 h-7 mx-auto animate-spin text-indigo-400 mb-2" />
                        Fetching payment records...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No recorded collections match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.paymentId} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{p.paymentId}</td>
                        <td className="py-3 px-4 font-bold text-white text-sm">{p.partyName}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {p.paymentDate}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${
                            p.mode === "Cash" 
                              ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                              : p.mode === "Cheque"
                                ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
                                : p.mode === "UPI"
                                  ? "bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-400"
                                  : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                          }`}>
                            {p.mode}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">{p.referenceNo}</td>
                        <td className="py-3 px-4 font-mono font-extrabold text-sm text-emerald-400 text-right pr-6">
                          ₹{p.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[250px] truncate" title={p.notes}>
                          {p.notes}
                        </td>
                        {isStaff && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeletePayment(p.paymentId)}
                              className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                              title="Delete payment receipt"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB 2: AUDITING PARTY LEDGER ==================== */}
      {activeTab === "Ledger" && (
        <div className="space-y-6">
          
          {/* Party selector parameters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose Audit Party *</label>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" />
                  <select
                    value={ledgerPartyId}
                    onChange={(e) => setLedgerPartyId(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {parties.map((p) => (
                      <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 font-mono">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">From Date</label>
                <input 
                  type="date" 
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-sans"
                />
              </div>

              <div className="space-y-1.5 font-mono">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">To Date</label>
                <input 
                  type="date" 
                  value={ledgerEndDate}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 lg:pt-0">
              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Printer className="w-4 h-4" />
                Print Statement / Export Ledger
              </button>
            </div>
          </div>

          {/* Party balance sheet status cards */}
          {selectedLedgerPartyObj && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opening / Predefined terms</span>
                <div className="mt-2 space-y-1">
                  <span className="text-white font-bold text-sm block">Terms: {selectedLedgerPartyObj.paymentTerms || "Not specified"}</span>
                  <p className="text-[9.5px] text-slate-400">Registered City: {selectedLedgerPartyObj.city || "N/A"}</p>
                </div>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Invoiced (Debit side sum)</span>
                <div className="mt-2 text-white font-black text-xl font-mono">
                  ₹{totalDebitsForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Payments (Credit side sum)</span>
                <div className="mt-2 text-emerald-400 font-black text-xl font-mono">
                  ₹{totalCreditsForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CURRENT OUTSTANDING BALANCE</span>
                <div className="mt-2">
                  <span className={`text-xl font-black font-mono ${
                    closingBalanceForSelectedParty > 0 
                      ? "text-rose-400 animate-pulse" 
                      : closingBalanceForSelectedParty === 0 
                        ? "text-slate-300"
                        : "text-emerald-400"
                  }`}>
                    ₹{closingBalanceForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                  <span className="text-[10px] font-bold block text-slate-500 mt-0.5">
                    {closingBalanceForSelectedParty > 0 ? "Debit Balance (Customer owes us)" : "Settled / Credit balance"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Table display of combined ledger statements */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-2xl font-sans" id="ledger-printable-pane">
            
            {/* Printable heading (normally hidden in standard UI) */}
            <div className="hidden print:block p-8 border-b border-slate-200 text-slate-900">
              <h1 className="text-xl font-black uppercase text-indigo-700">Textile ERP Co. Balance Statement</h1>
              <p className="text-xs text-slate-500">Commercial ledger generated on: {new Date().toLocaleString()}</p>
              <div className="mt-4 pt-4 border-t border-slate-200 font-bold text-xs">
                Account Party Name: {selectedLedgerPartyObj?.partyName} <br />
                Address: {selectedLedgerPartyObj?.address} | GSTIN: {selectedLedgerPartyObj?.gst}
              </div>
            </div>

            <div className="p-4 bg-slate-900/40 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Account Statement Ledger Lines</span>
              <span className="text-[10px] text-slate-400 font-mono">Doc Count: {ledgerLines.length}</span>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/10 text-slate-400 font-bold uppercase text-[9.5px] tracking-wider">
                    <th className="py-3 px-4">Post Date</th>
                    <th className="py-3 px-4">Document Ref No</th>
                    <th className="py-3 px-4">Voucher Type</th>
                    <th className="py-3 px-4">Particulars & Audit Remarks</th>
                    <th className="py-3 px-4 text-right pr-6 text-rose-400">Debit (₹)</th>
                    <th className="py-3 px-4 text-right pr-6 text-emerald-400">Credit (₹)</th>
                    <th className="py-3 px-4 text-right pr-6">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-250">
                  {ledgerLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                        No transactions found in this date range or setup. Record dispatches or payments first.
                      </td>
                    </tr>
                  ) : (
                    ledgerLines.map((line, idx) => (
                      <tr key={`${line.id}-${idx}`} className="hover:bg-white/[0.015] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium">{line.date}</td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-cyan-400">{line.id}</td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[9px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded border ${
                            line.docType === "Invoice/Dispatch"
                              ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                              : line.docType === "Payment Collection"
                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                : line.docType === "Journal Debit Voucher"
                                  ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                                  : "bg-teal-500/10 border-teal-500/25 text-teal-400"
                          }`}>
                            {line.docType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-350">{line.particulars}</td>
                        <td className="py-3.5 px-4 text-right pr-6 font-mono text-rose-400">
                          {line.debit > 0 ? `₹${line.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right pr-6 font-mono text-emerald-400">
                          {line.credit > 0 ? `₹${line.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className={`py-3.5 px-4 text-right pr-6 font-mono font-black ${
                          line.runningBalance > 0 ? "text-rose-450 text-rose-400" : "text-emerald-400"
                        }`}>
                          ₹{line.runningBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    ))
                  )}
                  {ledgerLines.length > 0 && (
                    <tr className="bg-slate-950 font-black text-sm">
                      <td colSpan={4} className="py-4 px-4 text-slate-400 uppercase text-right tracking-wider text-[10px]">Accounts Summary totals:</td>
                      <td className="py-4 px-4 text-right pr-6 font-mono text-rose-400">
                        ₹{totalDebitsForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="py-4 px-4 text-right pr-6 font-mono text-emerald-400">
                        ₹{totalCreditsForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className={`py-4 px-4 text-right pr-6 font-mono font-extrabold ${
                        closingBalanceForSelectedParty > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        ₹{closingBalanceForSelectedParty.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB 3: ADJUSTMENT JOURNAL VOUCHERS ==================== */}
      {activeTab === "Adjustments" && (
        <div className="space-y-6">
          
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Audit Journal Ledger Voucher Adjustments
              </h3>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                Adjust party balances manually for claims, special discounts, opening dues carrying balances, commissions, or bad-debt write-offs with audit justifications.
              </p>
            </div>
            {isStaff && (
              <button
                onClick={handleOpenAdjustmentForm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shrink-0"
              >
                <Plus className="w-4 h-4" />
                Issue Journal Entry
              </button>
            )}
          </div>

          {/* Vouchers directory list */}
          <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Adjustment ID</th>
                    <th className="py-3 px-4">Party Client Name</th>
                    <th className="py-3 px-4">Voucher Date</th>
                    <th className="py-3 px-4">Voucher Type</th>
                    <th className="py-3 px-4">Justification particulars</th>
                    <th className="py-3 px-4 text-right pr-6">Amount Offset</th>
                    {isStaff && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No manual ledger adjustments found. Post adjustments above if needed.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => (
                      <tr key={adj.adjustmentId} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">{adj.adjustmentId}</td>
                        <td className="py-3.5 px-4 font-extrabold text-white text-sm">{adj.partyName}</td>
                        <td className="py-3.5 px-4 font-mono">{adj.date}</td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[9px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded border ${
                            adj.type === "Debit"
                              ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                              : "bg-teal-500/10 border-teal-500/25 text-teal-400"
                          }`}>
                            {adj.type} Voucher (Increase Outstanding Account Debit)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-350">{adj.particulars}</td>
                        <td className={`py-3.5 px-4 font-mono font-extrabold text-right pr-6 ${
                          adj.type === "Debit" ? "text-rose-450 text-rose-400" : "text-emerald-400"
                        }`}>
                          ₹{adj.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {isStaff && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteAdjustment(adj.adjustmentId)}
                              className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                              title="Delete adjustment entry"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== FORM MODAL A: ADD PAYMENT RECEIPT ==================== */}
      {isOpenPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Record Payment Collection Receipt</h3>
              </div>
              <button onClick={() => setIsOpenPaymentForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs text-slate-305 text-slate-300">
              
              {/* Party Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Party Client *</label>
                <select
                  required
                  value={payPartyId}
                  onChange={(e) => setPayPartyId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Select Party --</option>
                  {parties.map((p) => (
                    <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
                  ))}
                </select>
              </div>

              {/* Receipt Date & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 font-mono">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Collection Date *</label>
                  <input 
                    type="date" 
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-emerald-400">Collected Amount (INR) *</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    placeholder="₹ Received amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Mode & Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receipt Mode *</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cheque">Banker Cheque / Draft</option>
                  </select>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Reference ID / Cheque No</label>
                  <input 
                    type="text" 
                    placeholder="e.g. UPI-TXN-9801..."
                    value={payRefNo}
                    onChange={(e) => setPayRefNo(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audit notes & Memo</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Advance captured or clean Invoice settlement..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenPaymentForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-md transition-all"
                >
                  {loading ? "Recording..." : "Record Payment Collection"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================== FORM MODAL B: ADD ADJUSTMENT JOURNAL VOUCHER ==================== */}
      {isOpenAdjustmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Issue Adjustment Journal Voucher</h3>
              </div>
              <button onClick={() => setIsOpenAdjustmentForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="p-6 space-y-4 text-xs text-slate-300">
              
              {/* Party Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Audit Party *</label>
                <select
                  required
                  value={adjPartyId}
                  onChange={(e) => setAdjPartyId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Party --</option>
                  {parties.map((p) => (
                    <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
                  ))}
                </select>
              </div>

              {/* Adjustment Type & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 font-mono">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Post Date *</label>
                  <input 
                    type="date" 
                    required
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Type *</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Debit">Debit Voucher (+ increases customer's outstanding liability)</option>
                    <option value="Credit">Credit Voucher (- decreases customer's outstanding liability / Claim)</option>
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-indigo-400">Offset Amount (INR) *</label>
                <input 
                  type="number" 
                  step="any"
                  required
                  placeholder="₹ Valor value"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Particulars Justification */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher explanation / Particulars Explanation *</label>
                <textarea 
                  rows={3}
                  required
                  placeholder="e.g. Opening carry forward from GJ-2025/2026 or special discount coupon..."
                  value={adjParticulars}
                  onChange={(e) => setAdjParticulars(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenAdjustmentForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl shadow-md transition-all"
                >
                  {loading ? "Recording Adjustment..." : "Post voucher to Ledger"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

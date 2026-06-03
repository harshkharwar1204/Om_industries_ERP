import React, { useState, useEffect } from "react";
import { 
  collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc, addDoc 
} from "firebase/firestore";
import { db, handleFirestoreError, logAuditEvent } from "../firebase";
import { 
  WorkerMaster, HanksProduction, DyeingProduction, ConningProduction, 
  WorkerUpaad, WorkerLoan, WorkerHapta, WorkerPagar, OperationType, WorkerAttendance 
} from "../types";
import { 
  Users, DollarSign, Wallet, ClipboardList, RefreshCw, Plus, Search, 
  X, Check, AlertTriangle, FileText, Printer, ArrowDownLeft, ArrowUpRight, 
  Trash2, ShieldCheck, Banknote, Calendar, Layers, Percent, Layers2, Eye, Download
} from "lucide-react";

interface WorkerFinanceViewProps {
  role: string;
}

type PayrollTab = "Dashboard" | "Wages" | "Upaad" | "Loans" | "Ledgers";

export const WorkerFinanceView: React.FC<WorkerFinanceViewProps> = ({ role }) => {
  const [activeTab, setActiveTab] = useState<PayrollTab>("Dashboard");
  const [workers, setWorkers] = useState<WorkerMaster[]>([]);
  const [hanksLogs, setHanksLogs] = useState<HanksProduction[]>([]);
  const [dyeingLogs, setDyeingLogs] = useState<DyeingProduction[]>([]);
  const [conningLogs, setConningLogs] = useState<ConningProduction[]>([]);

  // Worker Financial Documents
  const [pagars, setPagars] = useState<WorkerPagar[]>([]);
  const [upaads, setUpaads] = useState<WorkerUpaad[]>([]);
  const [loans, setLoans] = useState<WorkerLoan[]>([]);
  const [haptas, setHaptas] = useState<WorkerHapta[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<WorkerAttendance[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  // Loading & Alerts
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forms Toggle
  const [isOpenUpaadForm, setIsOpenUpaadForm] = useState(false);
  const [isOpenLoanForm, setIsOpenLoanForm] = useState(false);
  const [isOpenHaptaForm, setIsOpenHaptaForm] = useState(false);
  const [isOpenPagarForm, setIsOpenPagarForm] = useState(false);

  // Form State variables
  const [formWorkerId, setFormWorkerId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formParticulars, setFormParticulars] = useState("");

  // Special Loan Form
  const [loanHapta, setLoanHapta] = useState("");
  
  // Pagar builder inputs
  const [pagarStart, setPagarStart] = useState("");
  const [pagarEnd, setPagarEnd] = useState("");
  const [pagarBonus, setPagarBonus] = useState("");
  const [pagarHanksRate, setPagarHanksRate] = useState("");
  const [pagarDyeingRate, setPagarDyeingRate] = useState("");
  const [pagarConningRate, setPagarConningRate] = useState("");
  const [selectedConningBatchIds, setSelectedConningBatchIds] = useState<string[]>([]);
  const [pagarPaymentMode, setPagarPaymentMode] = useState<"Cash" | "Bank Transfer" | "UPI">("Cash");

  const isStaff = role === "owner" || role === "manager";

  // Helper date formatters
  const getTodayDate = () => new Date().toISOString().split("T")[0];

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

  // Bind live database listeners
  useEffect(() => {
    setLoading(true);

    const unsubWorkers = onSnapshot(collection(db, "worker_masters"), (snap) => {
      const list: WorkerMaster[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerMaster;
        if (!item.isDeleted) list.push(item);
      });
      setWorkers(list);
      if (list.length > 0 && !selectedWorkerId) {
        setSelectedWorkerId(list[0].workerId);
      }
    });

    const unsubHanks = onSnapshot(collection(db, "hanks_productions"), (snap) => {
      const list: HanksProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as HanksProduction;
        if (!item.isDeleted && item.status === "Approved") list.push(item);
      });
      setHanksLogs(list);
    });

    const unsubDyeing = onSnapshot(collection(db, "dyeing_productions"), (snap) => {
      const list: DyeingProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as DyeingProduction;
        if (!item.isDeleted && item.status === "Completed") list.push(item);
      });
      setDyeingLogs(list);
    });

    const unsubConning = onSnapshot(collection(db, "conning_productions"), (snap) => {
      const list: ConningProduction[] = [];
      snap.forEach(d => {
        const item = d.data() as ConningProduction;
        if (!item.isDeleted && item.status === "Completed") list.push(item);
      });
      setConningLogs(list);
    });

    // Worker accounts records
    const unsubPagars = onSnapshot(collection(db, "worker_pagars"), (snap) => {
      const list: WorkerPagar[] = [];
      snap.forEach(d => list.push(d.data() as WorkerPagar));
      list.sort((a,b) => b.periodEnd.localeCompare(a.periodEnd));
      setPagars(list);
    });

    const unsubUpaads = onSnapshot(collection(db, "worker_upaads"), (snap) => {
      const list: WorkerUpaad[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerUpaad;
        if (!item.isDeleted) list.push(item);
      });
      list.sort((a,b) => b.date.localeCompare(a.date));
      setUpaads(list);
    });

    const unsubLoans = onSnapshot(collection(db, "worker_loans"), (snap) => {
      const list: WorkerLoan[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerLoan;
        if (!item.isDeleted) list.push(item);
      });
      list.sort((a,b) => b.date.localeCompare(a.date));
      setLoans(list);
    });

    const unsubHaptas = onSnapshot(collection(db, "worker_haptas"), (snap) => {
      const list: WorkerHapta[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerHapta;
        if (!item.isDeleted) list.push(item);
      });
      list.sort((a,b) => b.date.localeCompare(a.date));
      setHaptas(list);
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance_logs"), (snap) => {
      const list: WorkerAttendance[] = [];
      snap.forEach(d => {
        const item = d.data() as WorkerAttendance;
        if (!item.isDeleted) list.push(item);
      });
      setAttendanceRecords(list);
      setLoading(false);
    });

    return () => {
      unsubWorkers();
      unsubHanks();
      unsubDyeing();
      unsubConning();
      unsubPagars();
      unsubUpaads();
      unsubLoans();
      unsubHaptas();
      unsubAttendance();
    };
  }, []);

  // Sync Pagar dates and rates on worker change
  useEffect(() => {
    if (selectedWorkerId) {
      const worker = workers.find(w => w.workerId === selectedWorkerId);
      if (worker) {
        setPagarHanksRate(String(worker.rate || 15)); // Default Hanks rate per Kg
        setPagarDyeingRate(worker.role.toLowerCase().includes("helper") ? "100" : "250"); // Operator vs Helper batch rates
        setPagarConningRate("2.5"); // Default Conning rate per cone
        setPagarBonus("0");
        setPagarStart(getPastDate(15));
        setPagarEnd(getTodayDate());
        setSelectedConningBatchIds([]);
      }
    }
  }, [selectedWorkerId, workers]);

  const getPastDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  // KPI Calculations
  const getWorkerStats = (workerId: string) => {
    const wrkUpaads = upaads.filter(u => u.workerId === workerId && !u.isDeleted);
    const wrkLoans = loans.filter(l => l.workerId === workerId && !l.isDeleted);
    const wrkHaptas = haptas.filter(h => h.workerId === workerId && !h.isDeleted);
    const wrkPagars = pagars.filter(p => p.workerId === workerId);

    // Sum totals
    const totalUpaadTaken = wrkUpaads.reduce((sum, u) => sum + u.amount, 0);
    // Deducted upaads in Pagars
    const upaadDeductedTotal = wrkPagars.reduce((sum, p) => sum + p.upaadDeducted, 0);
    const outstandingUpaad = totalUpaadTaken - upaadDeductedTotal;

    const totalLoansTaken = wrkLoans.reduce((sum, l) => sum + l.loanAmount, 0);
    const totalHaptaPaid = wrkHaptas.reduce((sum, h) => sum + h.amount, 0) + wrkPagars.reduce((sum, p) => sum + p.loanDeducted, 0);
    const outstandingLoan = Math.max(0, totalLoansTaken - totalHaptaPaid);

    const totalWagesEarned = wrkPagars.reduce((sum, p) => sum + p.grossWages, 0);
    const totalNetPaidOut = wrkPagars.reduce((sum, p) => sum + p.netWages, 0);

    return {
      outstandingUpaad,
      outstandingLoan,
      totalWagesEarned,
      totalNetPaidOut,
      activeLoan: wrkLoans.find(l => (l.loanAmount - (wrkHaptas.filter(h => h.loanId === l.loanId).reduce((s, h) => s + h.amount, 0))) > 0)
    };
  };

  // Wage Log Gatherers for target Period
  const compileDraftWages = (workerId: string, start: string, end: string) => {
    if (!workerId || !start || !end) return { 
      hanksKg: 0, 
      dyeingBatches: 0, 
      conningCones: 0,
      totalDaysPresent: 0,
      totalDaysHalf: 0,
      totalDaysAbsent: 0,
      totalDaysLeave: 0,
      attendanceWages: 0
    };

    // 1. Hanks filter
    const hanksJobs = hanksLogs.filter(h => 
      h.workerId === workerId && 
      formatFirebaseDate(h.createdAt) >= start && 
      formatFirebaseDate(h.createdAt) <= end
    );
    const hanksKg = hanksJobs.reduce((sum, h) => sum + (h.outputKg || 0), 0);

    // 2. Dyeing filter (Worker as Operator or Helper)
    const dyeingJobs = dyeingLogs.filter(d => 
      (d.operatorId === workerId || d.helperId === workerId) &&
      formatFirebaseDate(d.createdAt) >= start &&
      formatFirebaseDate(d.createdAt) <= end
    );
    const dyeingBatches = dyeingJobs.length;

    // 3. Conning filter (selected batch IDs)
    const activeConning = conningLogs.filter(c => 
      selectedConningBatchIds.includes(c.conningId)
    );
    const conningCones = activeConning.reduce((sum, c) => sum + (c.conesCount || 0), 0);

    // 4. Attendance filter
    const matchedAttendance = attendanceRecords.filter(a => 
      a.workerId === workerId && 
      a.date >= start && 
      a.date <= end
    );
    const totalDaysPresent = matchedAttendance.filter(a => a.status === "Present").length;
    const totalDaysHalf = matchedAttendance.filter(a => a.status === "Half Day").length;
    const totalDaysAbsent = matchedAttendance.filter(a => a.status === "Absent").length;
    const totalDaysLeave = matchedAttendance.filter(a => a.status === "Leave").length;
    const attendanceWages = matchedAttendance.reduce((sum, a) => sum + (a.earnedAmount || 0), 0);

    return {
      hanksKg,
      dyeingBatches,
      conningCones,
      totalDaysPresent,
      totalDaysHalf,
      totalDaysAbsent,
      totalDaysLeave,
      attendanceWages
    };
  };

  // Upaad submit
  const handleAddUpaad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formAmount || !formDate) {
      setErrorMsg("Please fill all required fields.");
      return;
    }
    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Please enter a valid positive amount.");
      return;
    }

    try {
      setLoading(true);
      const selectedWorker = workers.find(w => w.workerId === formWorkerId);
      const docId = `UPD-${Date.now()}`;
      
      const payload: WorkerUpaad = {
        upaadId: docId,
        workerId: formWorkerId,
        workerName: selectedWorker?.workerName || "Unknown Worker",
        date: formDate,
        amount: val,
        particulars: formParticulars.trim() || "Weekly Upad Draw",
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "worker_upaads", docId), payload);
      await logAuditEvent("Worker Upaad Registered", `Registered advance draw of ₹${val} for worker ${selectedWorker?.workerName}`);
      
      setSuccessMsg(`Successfully registered ₹${val} Advance (Upaad) for ${selectedWorker?.workerName}.`);
      setFormAmount("");
      setFormParticulars("");
      setIsOpenUpaadForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to store Upaad: " + err.message);
    }
  };

  // Loan submit
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formAmount || !loanHapta || !formDate || !formParticulars) {
      setErrorMsg("Please write correct Loan Principal, repayment Hapta and date.");
      return;
    }
    const principal = parseFloat(formAmount);
    const hapta = parseFloat(loanHapta);

    if (isNaN(principal) || principal <= 0 || isNaN(hapta) || hapta <= 0) {
      setErrorMsg("Amount parameters must be valid positive values.");
      return;
    }

    try {
      setLoading(true);
      const selectedWorker = workers.find(w => w.workerId === formWorkerId);
      const docId = `LN-${Date.now()}`;

      const payload: WorkerLoan = {
        loanId: docId,
        workerId: formWorkerId,
        workerName: selectedWorker?.workerName || "Unknown Worker",
        date: formDate,
        loanAmount: principal,
        haptaAmount: hapta,
        totalPaid: 0,
        outstanding: principal,
        particulars: formParticulars,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "worker_loans", docId), payload);
      await logAuditEvent("Worker Loan Disbursed", `Disbursed Principal Loan of ₹${principal} at Hapta ₹${hapta} per payout for ${selectedWorker?.workerName}`);

      setSuccessMsg(`Principal loan of ₹${principal} correctly registered for worker ${selectedWorker?.workerName}.`);
      setFormAmount("");
      setLoanHapta("");
      setFormParticulars("");
      setIsOpenLoanForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to store Loan entry: " + err.message);
    }
  };

  // Manual Hapta Payment
  const handleAddHapta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formAmount || !formDate || !formParticulars) {
      setErrorMsg("Confirm selected worker, loan block, amount and audit remark.");
      return;
    }
    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Repayment installment must be a valid positive number.");
      return;
    }

    // Find active loan
    const workerStats = getWorkerStats(formWorkerId);
    if (!workerStats.activeLoan) {
      setErrorMsg("This worker does not have any active outstanding Loan to pay hapta for.");
      return;
    }

    try {
      setLoading(true);
      const docId = `HPT-${Date.now()}`;
      const payload: WorkerHapta = {
        haptaId: docId,
        loanId: workerStats.activeLoan.loanId,
        workerId: formWorkerId,
        workerName: workerStats.activeLoan.workerName,
        date: formDate,
        amount: val,
        remarks: formParticulars,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "worker_haptas", docId), payload);
      await logAuditEvent("Worker Hapta installment repayment logged", `Received ₹${val} installment against loan ${workerStats.activeLoan.loanId} for worker ${workerStats.activeLoan.workerName}`);

      setSuccessMsg(`Deducted manual installment of ₹${val} for ${workerStats.activeLoan.workerName}.`);
      setFormAmount("");
      setFormParticulars("");
      setIsOpenHaptaForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Repayment logging failed: " + err.message);
    }
  };

  // Save/Generate Pagar
  const handleGeneratePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !pagarStart || !pagarEnd) {
      setErrorMsg("Please initialize selected dates and active worker.");
      return;
    }

    const hRate = parseFloat(pagarHanksRate) || 0;
    const dyRate = parseFloat(pagarDyeingRate) || 0;
    const coRate = parseFloat(pagarConningRate) || 0;
    const bonus = parseFloat(pagarBonus) || 0;

    const drafts = compileDraftWages(selectedWorkerId, pagarStart, pagarEnd);
    const stats = getWorkerStats(selectedWorkerId);
    const worker = workers.find(w => w.workerId === selectedWorkerId);
    const isDailyWageWorker = worker?.workerType === "Daily Wage";

    const hWages = isDailyWageWorker ? 0 : drafts.hanksKg * hRate;
    const dWages = isDailyWageWorker ? 0 : drafts.dyeingBatches * dyRate;
    const cWages = isDailyWageWorker ? 0 : drafts.conningCones * coRate;
    const attWages = isDailyWageWorker ? drafts.attendanceWages : 0;
    const grossVal = hWages + dWages + cWages + attWages + bonus;

    // Deducts upaads max up to grossVal, or total outstanding
    const dedUp = Math.min(stats.outstandingUpaad, grossVal);
    // Deducts loan hapta if outstanding and remaining wages allow
    const loanHapAmount = stats.activeLoan ? Math.min(stats.activeLoan.haptaAmount, stats.outstandingLoan, grossVal - dedUp) : 0;
    const netVal = Math.max(0, grossVal - dedUp - loanHapAmount);

    try {
      setLoading(true);
      const pagarId = `PAG-${Date.now().toString().slice(-6)}`;

      const payload: WorkerPagar = {
        pagarId,
        workerId: selectedWorkerId,
        workerName: worker?.workerName || "Unknown",
        periodStart: pagarStart,
        periodEnd: pagarEnd,
        hanksKg: isDailyWageWorker ? 0 : drafts.hanksKg,
        hanksWages: parseFloat(hWages.toFixed(2)),
        dyeingBatches: isDailyWageWorker ? 0 : drafts.dyeingBatches,
        dyeingWages: parseFloat(dWages.toFixed(2)),
        conningCones: isDailyWageWorker ? 0 : drafts.conningCones,
        conningWages: parseFloat(cWages.toFixed(2)),
        attendancePresentDays: drafts.totalDaysPresent,
        attendanceHalfDays: drafts.totalDaysHalf,
        attendanceAbsentDays: drafts.totalDaysAbsent,
        attendanceLeaveDays: drafts.totalDaysLeave,
        attendanceWages: parseFloat(attWages.toFixed(2)),
        grossWages: parseFloat(grossVal.toFixed(2)),
        upaadDeducted: parseFloat(dedUp.toFixed(2)),
        loanDeducted: parseFloat(loanHapAmount.toFixed(2)),
        bonusAmount: bonus,
        netWages: parseFloat(netVal.toFixed(2)),
        status: "Paid",
        paidDate: getTodayDate(),
        paymentMode: pagarPaymentMode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "worker_pagars", pagarId), payload);
      await logAuditEvent("Pagar Wages Paid", `Wages calculated and net ₹${netVal} fully paid to worker ${worker?.workerName} via ${pagarPaymentMode}`);

      setSuccessMsg(`Wages generated & net Pagar of ₹${netVal.toLocaleString()} successfully paid to ${worker?.workerName}!`);
      setIsOpenPagarForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to file payroll payout: " + err.message);
    }
  };

  // Delete Records
  const handleDeleteUpaad = async (id: string) => {
    if (!window.confirm("Mark this advance Upaad draft as cancelled?")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "worker_upaads", id), {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      await logAuditEvent("Worker Upaad Removed", `Cancelled advance document identifier ${id}`);
      setSuccessMsg("Advance Upaad marked as deleted.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to delete entry: " + err.message);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    if (!window.confirm("Remove this worker loan block? Ledger histories will modify.")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "worker_loans", id), {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      await logAuditEvent("Worker Loan Cancelled", `Cancelled worker loan identifier ${id}`);
      setSuccessMsg("Loan registry deleted.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to delete loan record: " + err.message);
    }
  };

  // LEDGER CONSTRUCTOR
  const generateWorkerLedger = () => {
    if (!selectedWorkerId) return [];

    interface WorkerLedgerLine {
      id: string;
      date: string;
      type: "Wage Credit" | "Upaad Advance" | "Loan Disbursment" | "Loan Hapta Repayment";
      particulars: string;
      credit: number; // worker earning
      debit: number;  // worker payout/advance
    }

    const lines: WorkerLedgerLine[] = [];

    // Pagars (Wages paid)
    pagars.forEach(p => {
      if (p.workerId === selectedWorkerId) {
        lines.push({
          id: p.pagarId,
          date: p.paidDate || formatFirebaseDate(p.createdAt),
          type: "Wage Credit",
          particulars: `Pagar Wages generated for period: ${p.periodStart} to ${p.periodEnd}. Hanks: ${p.hanksKg} Kg, Dyeing: ${p.dyeingBatches} batches, Cones: ${p.conningCones}`,
          credit: p.grossWages,
          debit: 0
        });

        // Deductions act as debits against credited earnings when balancing net payouts
        if (p.upaadDeducted > 0) {
          lines.push({
            id: `${p.pagarId}-u`,
            date: p.paidDate || formatFirebaseDate(p.createdAt),
            type: "Upaad Advance",
            particulars: `Salary deduction: Outstanding advance adjusted against salary`,
            credit: 0,
            debit: p.upaadDeducted
          });
        }

        if (p.loanDeducted > 0) {
          lines.push({
            id: `${p.pagarId}-l`,
            date: p.paidDate || formatFirebaseDate(p.createdAt),
            type: "Loan Hapta Repayment",
            particulars: `Salary deduction: Loan Hapta installment adjusted against salary`,
            credit: 0,
            debit: p.loanDeducted
          });
        }
      }
    });

    // Upaads
    upaads.forEach(u => {
      if (u.workerId === selectedWorkerId && !u.isDeleted) {
        lines.push({
          id: u.upaadId,
          date: u.date,
          type: "Upaad Advance",
          particulars: `${u.particulars}`,
          credit: 0,
          debit: u.amount
        });
      }
    });

    // Loans
    loans.forEach(l => {
      if (l.workerId === selectedWorkerId && !l.isDeleted) {
        lines.push({
          id: l.loanId,
          date: l.date,
          type: "Loan Disbursment",
          particulars: `Disbursed Principal Loan amount. Installment target: ${l.haptaAmount}/payment & notes: ${l.particulars}`,
          credit: 0,
          debit: l.loanAmount
        });
      }
    });

    // Haptas Repayments
    haptas.forEach(h => {
      if (h.workerId === selectedWorkerId && !h.isDeleted) {
        lines.push({
          id: h.haptaId,
          date: h.date,
          type: "Loan Hapta Repayment",
          particulars: `Direct installment paid back in cash. Memo: ${h.remarks}`,
          credit: h.amount,
          debit: 0
        });
      }
    });

    // Sort chronologically
    lines.sort((a,b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    // Running Balance: Credit earnings minus Debit payouts/advances
    let runningBal = 0;
    return lines.map(line => {
      // Outstanding negative means worker owes factory, positive means factory owes worker
      // Let's compute running balances: Earnings (credit) vs Draws/Advances (debit)
      runningBal += (line.credit - line.debit);
      return {
        ...line,
        runningBalance: runningBal
      };
    });
  };

  const currentLedger = generateWorkerLedger();
  const activeWorkerObj = workers.find(w => w.workerId === selectedWorkerId);

  // Form toggles with clear helpers
  const openUpaadDialog = () => {
    setFormWorkerId(selectedWorkerId);
    setFormDate(getTodayDate());
    setFormAmount("");
    setFormParticulars("");
    setIsOpenUpaadForm(true);
  };

  const openLoanDialog = () => {
    setFormWorkerId(selectedWorkerId);
    setFormDate(getTodayDate());
    setFormAmount("");
    setLoanHapta("");
    setFormParticulars("");
    setIsOpenLoanForm(true);
  };

  const openHaptaDialog = () => {
    setFormWorkerId(selectedWorkerId);
    setFormDate(getTodayDate());
    setFormAmount("");
    setFormParticulars("Manual loan installment payout");
    setIsOpenHaptaForm(true);
  };

  const openPagarDialog = () => {
    setIsOpenPagarForm(true);
  };

  // Compile active worker wages
  const drafts = compileDraftWages(selectedWorkerId, pagarStart, pagarEnd);
  const currentStats = getWorkerStats(selectedWorkerId);
  const isDailyWage = activeWorkerObj?.workerType === "Daily Wage";

  const calculateGrossDraft = () => {
    if (isDailyWage) {
      const bon = parseFloat(pagarBonus) || 0;
      return (drafts.attendanceWages || 0) + bon;
    }
    const hk = drafts.hanksKg * (parseFloat(pagarHanksRate) || 0);
    const dy = drafts.dyeingBatches * (parseFloat(pagarDyeingRate) || 0);
    const cn = drafts.conningCones * (parseFloat(pagarConningRate) || 0);
    const bon = parseFloat(pagarBonus) || 0;
    return hk + dy + cn + bon;
  };

  const calculateNetPagarDraft = () => {
    const gross = calculateGrossDraft();
    const upaadDed = Math.min(currentStats.outstandingUpaad, gross);
    const loanHap = currentStats.activeLoan ? Math.min(currentStats.activeLoan.haptaAmount, currentStats.outstandingLoan, gross - upaadDed) : 0;
    return Math.max(0, gross - upaadDed - loanHap);
  };

  const activeWorkerProfiles = workers.filter(w => {
    if (!searchQuery) return true;
    return w.workerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           w.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
           w.unit.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Alert Notices */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-xs animate-fadeIn">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 font-bold text-sm">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-xs animate-fadeIn">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 font-bold text-sm">&times;</button>
        </div>
      )}

      {/* Tabs navigation list */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveTab("Dashboard")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Dashboard" 
              ? "border-indigo-500 text-white bg-slate-900/30" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Owner Audit & alerts
        </button>
        <button
          onClick={() => setActiveTab("Wages")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Wages"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Banknote className="w-4 h-4" />
          Wages (Pagar payout)
        </button>
        <button
          onClick={() => setActiveTab("Upaad")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Upaad"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Advances (Upaad Draw)
        </button>
        <button
          onClick={() => setActiveTab("Loans")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Loans"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Percent className="w-4 h-4" />
          LOANS & hapta
        </button>
        <button
          onClick={() => setActiveTab("Ledgers")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "Ledgers"
              ? "border-indigo-500 text-white bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          Worker ledger sheet
        </button>
      </div>

      {/* ===================== tab 1: OWNER AUDIT DASHBOARD ===================== */}
      {activeTab === "Dashboard" && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Pagar Disbursed</span>
                <span className="text-xl font-black text-white font-mono">
                  ₹{pagars.reduce((sum, p) => sum + p.netWages, 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <Banknote className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Outstanding advances (Upaad)</span>
                <span className="text-xl font-black text-rose-400 font-mono">
                  ₹{(upaads.filter(u=>!u.isDeleted).reduce((sum, u) => sum + u.amount, 0) - pagars.reduce((sum, p) => sum + p.upaadDeducted, 0)).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/15">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Loan assets out</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  ₹{(loans.filter(l=>!l.isDeleted).reduce((sum, l) => sum + l.loanAmount, 0) - (haptas.filter(h=>!h.isDeleted).reduce((sum, h)=>sum+h.amount,0) + pagars.reduce((sum, p)=>sum+p.loanDeducted,0))).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/15">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Registered workforce</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {workers.length} <span className="text-xs font-sans text-slate-500 font-normal">Active Members</span>
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search staff members, units, production skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Alert explanations */}
            <div className="flex items-center gap-3 text-[10px] font-black text-rose-400 uppercase tracking-widest animate-pulse">
              <AlertTriangle className="w-4.5 h-4.5" />
              <span>Deductions Safety Matrix Active (Advance &gt; Wages triggers system alert)</span>
            </div>
          </div>

          {/* Core workforce payroll grid card matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {activeWorkerProfiles.map(w => {
              const stats = getWorkerStats(w.workerId);
              const weeklyWagesDraft = compileDraftWages(w.workerId, getPastDate(7), getTodayDate());
              const wageAccruedVal = (weeklyWagesDraft.hanksKg * (w.rate || 15)) + (weeklyWagesDraft.dyeingBatches * 200) + (weeklyWagesDraft.conningCones * 3);
              const isAlertDraw = stats.outstandingUpaad > wageAccruedVal && stats.outstandingUpaad > 2000;

              return (
                <div 
                  key={w.workerId} 
                  className={`bg-slate-950 border rounded-2xl p-5 hover:border-white/15 transition-all shadow-xl space-y-4 ${
                    isAlertDraw ? "border-rose-500/40" : "border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">{w.role} &bull; Unit {w.unit || "N/A"}</span>
                      <h4 className="text-sm font-extrabold text-white mt-1 uppercase tracking-tight">{w.workerName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {w.workerId} &bull; {w.mobile}</p>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border tracking-wide uppercase ${
                      isAlertDraw ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-white/5 border-white/10 text-slate-400"
                    }`}>
                      {isAlertDraw ? "Advance Alarm" : "Standard"}
                    </span>
                  </div>

                  {isAlertDraw && (
                    <div className="bg-rose-500/10 border border-rose-500/15 p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-rose-400 leading-normal animate-pulse">
                      <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                      <div>
                        <strong>Wages Safety Alert:</strong> Worker outstanding advance (₹{stats.outstandingUpaad.toLocaleString()}) exceeds total accrued weekly wages (₹{wageAccruedVal.toLocaleString()}).
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-white/[0.02]/30 p-3 rounded-xl border border-white/5 text-[11px] font-mono">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Active Advance (Upaad)</span>
                      <p className={`text-xs font-black ${stats.outstandingUpaad > 0 ? "text-rose-400" : "text-white"}`}>₹{stats.outstandingUpaad.toLocaleString()}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-medium">Outstanding Loan</span>
                      <p className={`text-xs font-black ${stats.outstandingLoan > 0 ? "text-amber-400" : "text-white"}`}>₹{stats.outstandingLoan.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedWorkerId(w.workerId);
                        setActiveTab("Wages");
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs py-2 rounded-lg font-bold border border-white/10 transition-colors uppercase tracking-wider"
                    >
                      Pay Pagar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWorkerId(w.workerId);
                        setActiveTab("Ledgers");
                      }}
                      className="px-3 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 rounded-lg border border-indigo-500/20 transition-colors"
                      title="Show balance ledger"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ===================== tab 2: WAGES / PAGAR GENERATION ===================== */}
      {activeTab === "Wages" && (
        <div className="space-y-6">
          
          {/* Form Filter Row */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Worker Profile *</label>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {workers.map(w => (
                  <option key={w.workerId} value={w.workerId}>{w.workerName} ({w.role})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Period Start Date *</label>
              <input 
                type="date" 
                value={pagarStart}
                onChange={(e) => setPagarStart(e.target.value)}
                className="bg-slate-950 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Period End Date *</label>
              <input 
                type="date" 
                value={pagarEnd}
                onChange={(e) => setPagarEnd(e.target.value)}
                className="bg-slate-950 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none font-sans"
              />
            </div>

            {isStaff && (
              <button
                onClick={openPagarDialog}
                className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Proceed with payout
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Panels: Draft Wage Accumulation Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* 1. Hanks calculations */}
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Hanks Output production draft</h3>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Rate per Kg: ₹{pagarHanksRate}</span>
                </div>

                <div className="overflow-x-auto text-xs font-sans">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="pb-2">Log No</th>
                        <th className="pb-2 text-center">Lot ID</th>
                        <th className="pb-2">Output Weight (Kg)</th>
                        <th className="pb-2">Wastage Loss %</th>
                        <th className="pb-2 text-right">Draft Wages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-350">
                      {hanksLogs.filter(h => h.workerId === selectedWorkerId && formatFirebaseDate(h.createdAt) >= pagarStart && formatFirebaseDate(h.createdAt) <= pagarEnd).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">No approved Hanks production records during this period.</td>
                        </tr>
                      ) : (
                        hanksLogs.filter(h => h.workerId === selectedWorkerId && formatFirebaseDate(h.createdAt) >= pagarStart && formatFirebaseDate(h.createdAt) <= pagarEnd).map(h => (
                          <tr key={h.productionId} className="hover:bg-white/[0.01]">
                            <td className="py-2.5 font-mono text-[10px] text-cyan-400">{h.productionId}</td>
                            <td className="py-2.5 text-center font-mono font-bold text-white">{h.lotId}</td>
                            <td className="py-2.5 font-mono">{h.outputKg.toFixed(2)} Kg</td>
                            <td className="py-2.5 font-mono">{h.lossPercent.toFixed(1)}%</td>
                            <td className="py-2.5 text-right font-mono text-emerald-400">₹{(h.outputKg * (parseFloat(pagarHanksRate)||0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Dyeing calculations */}
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers2 className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Dyeing Batches Processed</h3>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Rate per lot: ₹{pagarDyeingRate}</span>
                </div>

                <div className="overflow-x-auto text-xs font-sans">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="pb-2">Dye Log No</th>
                        <th className="pb-2">Assignment Role</th>
                        <th className="pb-2">Lot Ref</th>
                        <th className="pb-2">Dyeing weight</th>
                        <th className="pb-2 text-right">Draft Wages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-350">
                      {dyeingLogs.filter(d => (d.operatorId === selectedWorkerId || d.helperId === selectedWorkerId) && formatFirebaseDate(d.createdAt) >= pagarStart && formatFirebaseDate(d.createdAt) <= pagarEnd).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">No completed Dyeing batch operations logged.</td>
                        </tr>
                      ) : (
                        dyeingLogs.filter(d => (d.operatorId === selectedWorkerId || d.helperId === selectedWorkerId) && formatFirebaseDate(d.createdAt) >= pagarStart && formatFirebaseDate(d.createdAt) <= pagarEnd).map(d => {
                          const assignmentRole = d.operatorId === selectedWorkerId ? "Operator" : "Helper";
                          return (
                            <tr key={d.dyeingId} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 font-mono text-[10px] text-cyan-400">{d.dyeingId}</td>
                              <td className="py-2.5 font-bold uppercase tracking-wider font-mono text-[9px] text-amber-400">{assignmentRole}</td>
                              <td className="py-2.5 font-mono font-bold text-white">{d.lotId}</td>
                              <td className="py-2.5 font-mono">{d.outputKg.toFixed(2)} Kg</td>
                              <td className="py-2.5 text-right font-mono text-emerald-400">₹{(parseFloat(pagarDyeingRate)||0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Conning calculations */}
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Conning Winders Assignments</h3>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider font-sans">Rate per Cone: ₹{pagarConningRate}</span>
                </div>

                <div className="overflow-x-auto text-xs font-sans">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="pb-2">Checkbox</th>
                        <th className="pb-2">Coning Lot</th>
                        <th className="pb-2">Target Wind Cones</th>
                        <th className="pb-2">Exit weight</th>
                        <th className="pb-2 text-right">Draft Wages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-350">
                      {conningLogs.filter(c => formatFirebaseDate(c.createdAt) >= pagarStart && formatFirebaseDate(c.createdAt) <= pagarEnd).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">No wound conning runs queued during chosen dates.</td>
                        </tr>
                      ) : (
                        conningLogs.filter(c => formatFirebaseDate(c.createdAt) >= pagarStart && formatFirebaseDate(c.createdAt) <= pagarEnd).map(c => {
                          const isChecked = selectedConningBatchIds.includes(c.conningId);
                          return (
                            <tr key={c.conningId} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 text-center">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedConningBatchIds(prev => [...prev, c.conningId]);
                                    } else {
                                      setSelectedConningBatchIds(prev => prev.filter(id => id !== c.conningId));
                                    }
                                  }}
                                  className="w-4 h-4 cursor-pointer accent-indigo-505 accent-indigo-500"
                                />
                              </td>
                              <td className="py-2.5 font-mono text-[10px] text-cyan-400">{c.conningId} &bull; {c.lotId}</td>
                              <td className="py-2.5 font-mono font-bold text-white">{c.conesCount} Cones</td>
                              <td className="py-2.5 font-mono">{c.outputKg.toFixed(2)} Kg</td>
                              <td className="py-2.5 text-right font-mono text-emerald-450 text-emerald-400 font-extrabold">₹{(c.conesCount * (parseFloat(pagarConningRate)||0)).toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Panel: Summary & Deductions Card */}
            <div className="bg-slate-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl text-xs flex flex-col justify-between h-fit">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5">
                  <Banknote className="w-5 h-5 text-indigo-400" />
                  Pagar Payout Estimate
                </h3>

                <div className="mt-4 space-y-3 font-mono text-slate-300">
                  {isDailyWage ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Present Days:</span>
                        <span className="text-white font-mono">{drafts.totalDaysPresent} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Half Days:</span>
                        <span className="text-white font-mono">{drafts.totalDaysHalf} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-400 font-sans font-bold">Attendance Wages:</span>
                        <span className="text-emerald-400 font-bold">₹{drafts.attendanceWages.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Hanks wage component:</span>
                        <span className="text-white">₹{(drafts.hanksKg * (parseFloat(pagarHanksRate) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Dyeing component ({drafts.dyeingBatches} lots):</span>
                        <span className="text-white">₹{(drafts.dyeingBatches * (parseFloat(pagarDyeingRate) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Conning component ({drafts.conningCones} cones):</span>
                        <span className="text-white">₹{(drafts.conningCones * (parseFloat(pagarConningRate) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400 font-sans">Special Bonus / Allowance:</span>
                    <span className="text-white">₹{(parseFloat(pagarBonus) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="flex justify-between text-sm font-black text-rose-451 text-white uppercase tracking-wide border-b border-white/5 pb-2 font-sans">
                    <span>Gross Wages Accrued:</span>
                    <span>₹{calculateGrossDraft().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  {/* Deductions from ledger balance */}
                  <div className="pt-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 font-sans">Auto Adjusted Deductions</div>

                  <div className="flex justify-between text-rose-400">
                    <span className="font-sans">Outstanding Advance (Upaad):</span>
                    <span>₹{currentStats.outstandingUpaad.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-rose-400 border-b border-white/5 pb-2">
                    <span className="font-sans">Loan dues deducted:</span>
                    <span>₹{currentStats.outstandingLoan.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-sm pt-3 font-extrabold text-emerald-400 border-b border-white/10 pb-2">
                    <span>NET PAGAR PAYABLE:</span>
                    <span>₹{calculateNetPagarDraft().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={openPagarDialog}
                  disabled={calculateNetPagarDraft() <= 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 px-3 rounded-xl uppercase tracking-wider text-xs shadow-md transition-colors"
                >
                  Pay calculated wages (Pagar)
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ===================== tab 3: ADVANCES / UPAAD MANAGER ===================== */}
      {activeTab === "Upaad" && (
        <div className="space-y-6">
          
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <Wallet className="w-5 h-5 text-indigo-400" />
                Staff Advance Payments & Upaad Registry
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Issue manual payments in advance of regular salaries. Outstanding balances will automatically offset against calculated wages during core Pagar generation.
              </p>
            </div>
            {isStaff && (
              <button
                onClick={openUpaadDialog}
                className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shrink-0 uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                Disburse Advance Draw
              </button>
            )}
          </div>

          {/* Table list */}
          <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Doc ID</th>
                    <th className="py-3 px-4">Worker Profile Name</th>
                    <th className="py-3 px-4">Disbursal Date</th>
                    <th className="py-3 px-4">Justification Remarks</th>
                    <th className="py-3 px-4 text-right pr-8">Principal Amount Disbursed</th>
                    {isStaff && <th className="py-3 px-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-350">
                  {upaads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">No active advance draws registered in history.</td>
                    </tr>
                  ) : (
                    upaads.map(u => (
                      <tr key={u.upaadId} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-400">{u.upaadId}</td>
                        <td className="py-3 px-4 font-extrabold text-white text-sm">{u.workerName}</td>
                        <td className="py-3 px-4 font-mono">{u.date}</td>
                        <td className="py-3 px-4 text-slate-400">{u.particulars}</td>
                        <td className="py-3 px-4 text-right pr-8 font-mono font-black text-rose-450 text-rose-400">₹{u.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        {isStaff && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteUpaad(u.upaadId)}
                              className="text-slate-500 hover:text-red-400 hover:bg-rose-500/10 p-1.5 rounded transition-colors"
                              title="Delete/Cancel advance"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* ===================== tab 4: LOANS & INSTALLMENTS ===================== */}
      {activeTab === "Loans" && (
        <div className="space-y-6">
          
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <Percent className="w-5 h-5 text-indigo-400" />
                Staff Long-Term Loans & Instalments (Hapta Scheme)
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Disburse larger capital sums alongside set hapta targets per payout. Track full repayment ledger logs and manually or automatically subtract installments from pagar payouts.
              </p>
            </div>
            {isStaff && (
              <div className="flex gap-2">
                <button
                  onClick={openLoanDialog}
                  className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shrink-0 uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  Grant Principal Loan
                </button>
                <button
                  onClick={openHaptaDialog}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shrink-0 uppercase tracking-wider"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Record cash Hapta
                </button>
              </div>
            )}
          </div>

          {/* Loans grid list */}
          <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl text-xs font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Loan Code</th>
                    <th className="py-3 px-4">Borrowing Worker</th>
                    <th className="py-3 px-4">Disbursal Date</th>
                    <th className="py-3 px-4">Installment Hapta / pay</th>
                    <th className="py-3 px-4 text-right">Loan Principal</th>
                    <th className="py-3 px-4 text-right">Outstanding Bal</th>
                    <th className="py-3 px-4 text-right pr-6">Status</th>
                    {isStaff && <th className="py-3 px-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-350">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">No active long-term loans disbursed to date.</td>
                    </tr>
                  ) : (
                    loans.map(l => {
                      const totalHaptaPaid = haptas.filter(h => h.loanId === l.loanId && !h.isDeleted).reduce((sum, h) => sum + h.amount, 0) + pagars.filter(p => p.workerId === l.workerId).reduce((sum, p) => sum + p.loanDeducted, 0);
                      const outstanding = Math.max(0, l.loanAmount - totalHaptaPaid);
                      const isSettled = outstanding <= 0;
                      return (
                        <tr key={l.loanId} className="hover:bg-white/[0.01]">
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">{l.loanId}</td>
                          <td className="py-3.5 px-4 font-extrabold text-white text-sm">{l.workerName}</td>
                          <td className="py-3.5 px-4 font-mono">{l.date}</td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-amber-400">₹{l.haptaAmount.toLocaleString()}/hapta</td>
                          <td className="py-3.5 px-4 text-right font-mono">₹{l.loanAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400">₹{outstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="py-3.5 px-4 text-right pr-6 font-bold">
                            <span className={`text-[9px] uppercase px-2 py-0.5 rounded border ${
                              isSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-sans" : "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse font-sans"
                            }`}>
                              {isSettled ? "Settled" : "Outstanding"}
                            </span>
                          </td>
                          {isStaff && (
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleDeleteLoan(l.loanId)}
                                className="text-slate-500 hover:text-red-400 hover:bg-rose-500/10 p-1.5 rounded transition-colors"
                                title="Cancel loan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ===================== tab 5: WORKER CHRONOLOGICAL LEDGER SHEET ===================== */}
      {activeTab === "Ledgersors" || activeTab === "Ledgers" && (
        <div className="space-y-6">
          
          {/* Document selection parameters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose Active Worker Profile *</label>
                <div className="flex items-center gap-2">
                  <span className="p-2.5 bg-indigo-500/15 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Users className="w-4 h-4" />
                  </span>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {workers.map(w => (
                      <option key={w.workerId} value={w.workerId}>{w.workerName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 lg:pt-0">
              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all uppercase tracking-wider"
              >
                <Printer className="w-4 h-4" />
                Print Statement / Export PDF
              </button>
            </div>
          </div>

          {activeWorkerObj && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Predefined terms & Job</span>
                <div className="mt-2 text-white font-extrabold text-sm block tracking-widest uppercase">{activeWorkerObj.role}</div>
                <span className="text-[10px] text-slate-500 block">Assigned Unit: {activeWorkerObj.unit || "N/A"}</span>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Advance draws</span>
                <div className="mt-2 text-rose-400 font-black text-xl font-mono">
                  ₹{currentStats.outstandingUpaad.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Loan (Installment Scheme)</span>
                <div className="mt-2 text-amber-400 font-black text-xl font-mono">
                  ₹{currentStats.outstandingLoan.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>

              <div className="bg-slate-950 border border-white/10 rounded-2xl p-5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Ledger Balance</span>
                <div className="mt-2">
                  <span className={`text-xl font-black font-mono ${
                    currentLedger.length > 0 && currentLedger[currentLedger.length - 1].runningBalance < 0
                      ? "text-rose-450 text-rose-400" 
                      : "text-emerald-400"
                  }`}>
                    ₹{(currentLedger.length > 0 ? currentLedger[currentLedger.length - 1].runningBalance : 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {currentLedger.length > 0 && currentLedger[currentLedger.length - 1].runningBalance < 0 ? "Debit (Worker owes factory)" : "Settled / Credit"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ledger table */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-2xl font-sans" id="worker-ledger-pane">
            <div className="p-4 bg-slate-900/40 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Account Statement Ledger Lines</span>
              <span className="text-[10px] text-slate-400 font-mono">Operation Code Count: {currentLedger.length}</span>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/10 text-slate-405 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="py-3 px-4">Post Date</th>
                    <th className="py-3 px-4">Document Ref No</th>
                    <th className="py-3 px-4">Voucher Type</th>
                    <th className="py-3 px-4">Particulars & Audit Remarks</th>
                    <th className="py-3 px-4 text-right text-emerald-400">Credit (₹)</th>
                    <th className="py-3 px-4 text-right text-rose-400">Debit (₹)</th>
                    <th className="py-3 px-4 text-right pr-6">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {currentLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">No account ledger transactions found. Disburse advances/loans first.</td>
                    </tr>
                  ) : (
                    currentLedger.map((line, index) => (
                      <tr key={`${line.id}-${index}`} className="hover:bg-white/[0.015]">
                        <td className="py-3 px-4 font-mono">{line.date}</td>
                        <td className="py-3 px-4 font-mono font-bold text-cyan-400">{line.id}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded border tracking-wide font-black ${
                            line.type === "Wage Credit"
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-sans"
                              : line.type === "Upaad Advance"
                                ? "bg-rose-500/10 border-rose-500/25 text-rose-400 font-sans"
                                : line.type === "Loan Disbursment"
                                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400 font-sans"
                                  : "bg-teal-500/10 border-teal-500/25 text-teal-400 font-sans"
                          }`}>
                            {line.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-[300px] truncate" title={line.particulars}>{line.particulars}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {line.credit > 0 ? `₹${line.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">
                          {line.debit > 0 ? `₹${line.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className={`py-3 px-4 text-right pr-6 font-mono font-black ${
                          line.runningBalance < 0 ? "text-rose-400 focus:outline-none" : "text-emerald-400"
                        }`}>
                          ₹{line.runningBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ===================== FORM MODAL A: ISSUE ADVANCE DRAW ===================== */}
      {isOpenUpaadForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Disburse Advance (Upaad Draw)</h3>
              </div>
              <button onClick={() => setIsOpenUpaadForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddUpaad} className="p-6 space-y-4 text-slate-300">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Borrower Worker Name *</label>
                <select
                  required
                  value={formWorkerId}
                  onChange={(e) => setFormWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none"
                >
                  <option value="">-- Choose target --</option>
                  {workers.map(w => (
                    <option key={w.workerId} value={w.workerId}>{w.workerName} ({w.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disbursal Date *</label>
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Amount (₹) *</label>
                  <input 
                    type="number"
                    required
                    placeholder="Wages Advance Value"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Justification Particulars *</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="e.g. Festival Advance, Medical emergency draw..."
                  value={formParticulars}
                  onChange={(e) => setFormParticulars(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenUpaadForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  {loading ? "Processing..." : "Disburse draw"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== FORM MODAL B: GRANT PRINCIPAL LOAN ===================== */}
      {isOpenLoanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-1.5">
                <Percent className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Disburse Long-Term Roster Loan</h3>
              </div>
              <button onClick={() => setIsOpenLoanForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddLoan} className="p-6 space-y-4 text-slate-300 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eligible borrowing worker *</label>
                <select
                  required
                  value={formWorkerId}
                  onChange={(e) => setFormWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none"
                >
                  <option value="">-- Select --</option>
                  {workers.map(w => (
                    <option key={w.workerId} value={w.workerId}>{w.workerName} ({w.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disbursal Date *</label>
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loan Principal amount *</label>
                  <input 
                    type="number"
                    required
                    placeholder="₹ Principal sum"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-amber-400">Installment Deduction target (₹/hapta) *</label>
                <input 
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={loanHapta}
                  onChange={(e) => setLoanHapta(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none font-extrabold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit particulars description *</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="e.g. Housing support loans, bicycle purchase advances..."
                  value={formParticulars}
                  onChange={(e) => setFormParticulars(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenLoanForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  {loading ? "Filing..." : "Issue Loan Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== FORM MODAL C: RECORD CASH HAPTA INSTALLMENT ===================== */}
      {isOpenHaptaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-5 h-5 text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-sans">Record Cash Loan Hapta Instalment</h3>
              </div>
              <button onClick={() => setIsOpenHaptaForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddHapta} className="p-6 space-y-4 text-slate-300 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paying Worker Name *</label>
                <select
                  required
                  value={formWorkerId}
                  onChange={(e) => setFormWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none"
                >
                  <option value="">-- Choose Borrowing worker --</option>
                  {workers.map(w => {
                    const stats = getWorkerStats(w.workerId);
                    if (stats.outstandingLoan <= 0) return null;
                    return (
                      <option key={w.workerId} value={w.workerId}>{w.workerName} (Owe: ₹{stats.outstandingLoan})</option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repay Date *</label>
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Installment Value (₹) *</label>
                  <input 
                    type="number"
                    required
                    placeholder="Instalment sum"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipt Audit Remarks *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Paid cash directly for installment..."
                  value={formParticulars}
                  onChange={(e) => setFormParticulars(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans outline-none font-extrabold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenHaptaForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  {loading ? "Filing..." : "Record installment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== FORM MODAL D: DISBURSE WAGES (PAGAR) ===================== */}
      {isOpenPagarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950 text-white">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Approve & Disburse Pagar Wages</h3>
              </div>
              <button onClick={() => setIsOpenPagarForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleGeneratePagar} className="p-6 space-y-4 text-slate-300 text-xs">
              <div className="bg-white/5 p-4 rounded-xl space-y-1.5 border border-white/5">
                <span className="text-[9px] text-slate-400 uppercase font-sans tracking-wide">Target employee</span>
                <p className="text-sm font-extrabold text-white uppercase tracking-tight">{activeWorkerObj?.workerName}</p>
                <p className="text-[10px] text-indigo-400 font-mono">Job: {activeWorkerObj?.role}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Payment Mode *</label>
                  <select
                    value={pagarPaymentMode}
                    onChange={(e) => setPagarPaymentMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none font-bold"
                  >
                    <option value="Cash">Cash Handout</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI (GPay / PhonePe)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wage bonus reward (₹)</label>
                  <input 
                    type="number"
                    placeholder="Bonus reward"
                    value={pagarBonus}
                    onChange={(e) => setPagarBonus(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl space-y-2 border border-white/5 font-mono text-[11px]">
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="font-sans text-slate-400">Total Accrued Wages:</span>
                  <span className="text-white font-bold">₹{calculateGrossDraft().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-rose-451 text-rose-400 border-b border-white/5 pb-1.5">
                  <span className="font-sans text-slate-400">Advances Deducted:</span>
                  <span>-₹{Math.min(currentStats.outstandingUpaad, calculateGrossDraft()).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-amber-400 border-b border-white/5 pb-1.5">
                  <span className="font-sans text-slate-400">Loan Installment Deductors:</span>
                  <span>-₹{(currentStats.activeLoan ? Math.min(currentStats.activeLoan.haptaAmount, currentStats.outstandingLoan, calculateGrossDraft() - Math.min(currentStats.outstandingUpaad, calculateGrossDraft())) : 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-emerald-400 pt-1">
                  <span>NET CASH HANDOVER:</span>
                  <span>₹{calculateNetPagarDraft().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenPagarForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading || calculateNetPagarDraft() <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  {loading ? "Recording payout..." : "Confirm & Pay Salary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, updateDoc, where, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { useAuth } from "./AuthProvider";
import { UserProfile, WorkerLookup, Task, OperationType, Party } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { ItemMasterView } from "./ItemMasterView";
import { ShadeMasterView } from "./ShadeMasterView";
import { MachineMasterView } from "./MachineMasterView";
import { RateMasterView } from "./RateMasterView";
import { PartyMasterView } from "./PartyMasterView";
import { WorkerMasterView } from "./WorkerMasterView";
import { PartyOrderView } from "./PartyOrderView";
import { GreyStockView } from "./GreyStockView";
import { HanksProductionView } from "./HanksProductionView";
import { DyeingProductionView } from "./DyeingProductionView";
import { ConningProductionView } from "./ConningProductionView";
import { ReadyStockView } from "./ReadyStockView";
import { DispatchView } from "./DispatchView";
import { FinanceView } from "./FinanceView";
import { WorkerFinanceView } from "./WorkerFinanceView";
import { ReportsView } from "./ReportsView";
import { SystemUtilitiesView } from "./SystemUtilitiesView";
import { AttendanceView } from "./AttendanceView";

import { 
  LayoutDashboard, Database, Cpu, Truck, Wallet, FileText, 
  Menu, X, Bell, Search, User, CheckCircle, Clock, AlertTriangle, 
  TrendingUp, TrendingDown, DollarSign, LogOut, RefreshCw, Plus, 
  Trash2, UserCheck, Briefcase, Layers, Shield, Activity, HelpCircle,
  FileDown, Check, ChevronRight, Filter, Info, Package, MapPin, Loader2, ArrowUpRight,
  ShoppingBag, Box, QrCode, Calendar
} from "lucide-react";

type MenuType = "Dashboard" | "Masters" | "Orders" | "Grey Stock" | "Hanks Production" | "Dyeing Production" | "Conning Production" | "Ready Stock" | "Production" | "Dispatch" | "Finance" | "Attendance" | "Reports" | "Utilities";

export const ERPLayout: React.FC = () => {
  const { user, userProfile, workerProfile, logout, refreshProfile } = useAuth();
  const role = userProfile?.role || "worker";
  const targetWorkerId = workerProfile?.workerId || userProfile?.workerId;

  // Active Screen Tab
  const [activeMenu, setActiveMenu] = useState<MenuType>("Dashboard");
  const [financeSubTab, setFinanceSubTab] = useState<"client" | "worker">("client");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Firestore Real-time Collections Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<WorkerLookup[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Form states for Party Master
  const [partyName, setPartyName] = useState("");
  const [partyMobile, setPartyMobile] = useState("");
  const [partyCity, setPartyCity] = useState("");
  const [partyGst, setPartyGst] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyPaymentTerms, setPartyPaymentTerms] = useState("Net 30");

  // Search, filter, and UI states for Parties
  const [partySearch, setPartySearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [viewingParty, setViewingParty] = useState<Party | null>(null);

  // Editing Party states
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editPartyName, setEditPartyName] = useState("");
  const [editPartyMobile, setEditPartyMobile] = useState("");
  const [editPartyCity, setEditPartyCity] = useState("");
  const [editPartyGst, setEditPartyGst] = useState("");
  const [editPartyAddress, setEditPartyAddress] = useState("");
  const [editPartyPaymentTerms, setEditPartyPaymentTerms] = useState("");

  // Sub-tab structure within the "Masters" page
  const [mastersSubTab, setMastersSubTab] = useState<"parties" | "items" | "shades" | "machines" | "rates" | "workers" | "workerMaster">("parties");

  // Helper function to format timestamp beautifully
  const formatPartyDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString();
    }
    if (typeof timestamp === "string") {
      return new Date(timestamp).toLocaleString();
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    return String(timestamp);
  };

  // Operation / Loader states
  const [opsLoading, setOpsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local static master data (Materials/Products) for the Masters ERP view
  const [materialMaster, setMaterialMaster] = useState([
    { code: "M-101", name: "Grade-A Silicon Wafer", stock: 1240, unit: "pcs", section: "Semiconductors", price: 45 },
    { code: "M-102", name: "High-Purity Copper Wire", stock: 850, unit: "m", section: "Conductive Metals", price: 12 },
    { code: "M-103", name: "Reinforced Steel Backplate", stock: 420, unit: "pcs", section: "Structural Mounts", price: 85 },
    { code: "M-104", name: "Conductive Adhesive Paste", stock: 95, unit: "kg", section: "Chemical Bonding", price: 120 },
    { code: "M-105", name: "Insulating Epoxy Glaze", stock: 160, unit: "L", section: "Chemical Bonding", price: 75 }
  ]);

  // States to add material
  const [newMatName, setNewMatName] = useState("");
  const [newMatStock, setNewMatStock] = useState("");
  const [newMatUnit, setNewMatUnit] = useState("pcs");
  const [newMatSection, setNewMatSection] = useState("Semiconductors");
  const [newMatPrice, setNewMatPrice] = useState("");

  // Form States: Task creation
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  // Form States: Worker registration
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState<"manager" | "worker">("worker");
  const [regWorkerId, setRegWorkerId] = useState("");
  const [regMobile, setRegMobile] = useState("");

  // Form States: Finance Invoice creation
  const [financeTransactions, setFinanceTransactions] = useState([
    { id: "TX-4890", category: "Revenue", description: "Material Dispatch: Batch B-810", amount: 4850, type: "income", date: "2026-05-29" },
    { id: "TX-4889", category: "Direct Labor", description: "Worker Overtime Allowances", amount: 1200, type: "expense", date: "2026-05-28" },
    { id: "TX-4888", category: "Raw Materials", description: "Procured Silicon Wafer Reserves", amount: 3100, type: "expense", date: "2026-05-28" },
    { id: "TX-4887", category: "Revenue", description: "Client Audit Payment Line A", amount: 2500, type: "income", date: "2026-05-27" },
    { id: "TX-4886", category: "Utility Bills", description: "Power Grid Usage Grid 3", amount: 840, type: "expense", date: "2026-05-25" }
  ]);
  const [txCategory, setTxCategory] = useState("Revenue");
  const [txDesc, setTxDesc] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("income");

  // Notifications List
  const [notifications, setNotifications] = useState<Array<{id: string, text: string, type: 'info' | 'success' | 'alert', read: boolean, time: string}>>([
    { id: "1", text: "Database connection established successfully", type: "success", read: false, time: "Just now" },
    { id: "2", text: "Material stock alert: Conductive Adhesive Paste running low (95 kg left)", type: "alert", read: false, time: "10m ago" },
    { id: "3", text: "Role-based authorization rules applied securely", type: "info", read: true, time: "1h ago" }
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Reports view state Filter
  const [reportFilterType, setReportFilterType] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [reportDateRange, setReportDateRange] = useState("last_30_days");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReportResult, setGeneratedReportResult] = useState<string | null>(null);

  // Firestore Subscriptions
  useEffect(() => {
    setDataLoading(true);
    
    let unsubscribeTasks = () => {};
    let unsubscribeUsers = () => {};

    // 1. Subscribe Tasks (Conditional on User Role to prevent security rule violations)
    if (role === "owner" || role === "manager") {
      unsubscribeTasks = onSnapshot(
        collection(db, "tasks"),
        (snap) => {
          const loadedTasks: Task[] = [];
          snap.forEach((docSnap) => {
            loadedTasks.push(docSnap.data() as Task);
          });
          setTasks(loadedTasks);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "tasks");
        }
      );
    } else {
      // Worker - only subscribe to their own tasks. Filter query using 'where' terms to satisfy Firestore line-level rules
      const workerId = targetWorkerId || "";
      const workerName = userProfile?.displayName || "";
      const queryTerms = [workerId, workerName].filter(Boolean);

      if (queryTerms.length > 0) {
        unsubscribeTasks = onSnapshot(
          query(collection(db, "tasks"), where("assignedWorkerId", "in", queryTerms)),
          (snap) => {
            const loadedTasks: Task[] = [];
            snap.forEach((docSnap) => {
              loadedTasks.push(docSnap.data() as Task);
            });
            setTasks(loadedTasks);
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, "tasks");
          }
        );
      } else {
        setTasks([]);
      }
    }

    // Subscribe Workers Registry
    const unsubscribeWorkers = onSnapshot(
      collection(db, "workers"),
      (snap) => {
        const loadedWorkers: WorkerLookup[] = [];
        snap.forEach((docSnap) => {
          loadedWorkers.push(docSnap.data() as WorkerLookup);
        });
        setWorkers(loadedWorkers);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "workers");
      }
    );

    // 2. Subscribe Users Registry (Only for owners or managers)
    if (role === "owner" || role === "manager") {
      unsubscribeUsers = onSnapshot(
        collection(db, "users"),
        (snap) => {
          const loadedUsers: UserProfile[] = [];
          snap.forEach((docSnap) => {
            loadedUsers.push(docSnap.data() as UserProfile);
          });
          setUsers(loadedUsers);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "users");
        }
      );
    } else {
      setUsers([]);
    }

    // Subscribe Parties Registry
    const unsubscribeParties = onSnapshot(
      collection(db, "parties"),
      (snap) => {
        const loadedParties: Party[] = [];
        snap.forEach((docSnap) => {
          loadedParties.push(docSnap.data() as Party);
        });
        setParties(loadedParties);
        setDataLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "parties");
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeWorkers();
      unsubscribeUsers();
      unsubscribeParties();
    };
  }, [role, targetWorkerId, userProfile?.displayName]);

  // Operation Helpers for alerts
  const showAlert = (success: string | null, error: string | null) => {
    setSuccessMsg(success);
    setErrorMsg(error);
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 6000);
  };

  // Operation: Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDesc.trim() || !taskAssignee) {
      showAlert(null, "Please supply a title, description, and assigned operator.");
      return;
    }

    setOpsLoading(true);
    try {
      const taskId = `TSK-${Date.now().toString().slice(-5)}`;
      const taskDocRef = doc(db, "tasks", taskId);

      const newTaskPayload: Task = {
        taskId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assignedWorkerId: taskAssignee,
        createdBy: userProfile?.displayName || "ERP Operations",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(taskDocRef, newTaskPayload);
      
      // Add notification
      const newNotify = {
        id: Date.now().toString(),
        text: `New dispatch work order ${taskId} created for operator ${taskAssignee}`,
        type: 'success' as const,
        read: false,
        time: "Just now"
      };
      setNotifications(prev => [newNotify, ...prev]);

      showAlert(`Dispatch Work Order "${taskId}" successfully broadcasted.`, null);
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
    } catch (err: any) {
      console.error(err);
      showAlert(null, `Database Authorization Failed: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Register Staff/Worker
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      showAlert(null, "Complete Name and Access Email are mandatory.");
      return;
    }

    if (regRole === "worker" && (!regWorkerId.trim() || !regMobile.trim())) {
      showAlert(null, "Worker registrations require an active Shift Worker ID (PIN login) and Mobile Contact.");
      return;
    }

    setOpsLoading(true);
    try {
      if (regRole === "worker") {
        const uppercaseId = regWorkerId.trim().toUpperCase();
        
        // 1. Write profile to the system users collection
        const userDocRef = doc(db, "users", `uid-${uppercaseId}`);
        const newUserPayload: UserProfile = {
          userId: `uid-${uppercaseId}`,
          email: regEmail.trim().toLowerCase(),
          role: "worker",
          displayName: regName.trim(),
          workerId: uppercaseId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUserPayload);

        // 2. Write details inside workers search lookup index
        const workerDocRef = doc(db, "workers", uppercaseId);
        const newWorkerPayload: WorkerLookup = {
          workerId: uppercaseId,
          mobileNumber: regMobile.trim(),
          userId: `uid-${uppercaseId}`,
          name: regName.trim(),
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(workerDocRef, newWorkerPayload);

        showAlert(`Worker profile with ID ${uppercaseId} registered inside corporate schema.`, null);
      } else {
        const managerId = `MGR-${Date.now().toString().slice(-4)}`;
        const userDocRef = doc(db, "users", `uid-${managerId}`);
        const newUserPayload: UserProfile = {
          userId: `uid-${managerId}`,
          email: regEmail.trim().toLowerCase(),
          role: "manager",
          displayName: regName.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUserPayload);

        showAlert(`Manager profile registered successfully. User was assigned key: ${managerId}.`, null);
      }

      setRegName("");
      setRegEmail("");
      setRegWorkerId("");
      setRegMobile("");
    } catch (err: any) {
      console.error(err);
      showAlert(null, `Access authorization error: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // ==================== PARTY MASTER CRUD OPERATIONS ====================

  // Operation: Add Party
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim() || !partyMobile.trim() || !partyCity.trim() || !partyAddress.trim()) {
      showAlert(null, "Party Name, Mobile, City, and Address are required fields.");
      return;
    }

    setOpsLoading(true);
    try {
      const partyId = `PRT-${Date.now().toString().slice(-5)}`;
      const partyDocRef = doc(db, "parties", partyId);

      const newPartyPayload = {
        partyId,
        partyName: partyName.trim(),
        mobile: partyMobile.trim(),
        city: partyCity.trim(),
        gst: partyGst.trim() || "N/A",
        address: partyAddress.trim(),
        paymentTerms: partyPaymentTerms,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(partyDocRef, newPartyPayload);

      showAlert(`Party "${partyName.trim()}" successfully registered in directory under ID ${partyId}.`, null);
      
      // Reset form variables
      setPartyName("");
      setPartyMobile("");
      setPartyCity("");
      setPartyGst("");
      setPartyAddress("");
      setPartyPaymentTerms("Net 30");

      // Add a corporate notification log
      const newNotify = {
        id: Date.now().toString(),
        text: `New Party Master Registered: ${partyName.trim()} (ID: ${partyId})`,
        type: "success" as const,
        read: false,
        time: "Just now"
      };
      setNotifications(prev => [newNotify, ...prev]);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "parties");
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Edit/Update Party Parameters
  const handleUpdateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;

    if (!editPartyName.trim() || !editPartyMobile.trim() || !editPartyCity.trim() || !editPartyAddress.trim()) {
      showAlert(null, "Name, Mobile, City, and Address cannot be empty on update.");
      return;
    }

    setOpsLoading(true);
    try {
      const partyDocRef = doc(db, "parties", editingParty.partyId);

      await updateDoc(partyDocRef, {
        partyName: editPartyName.trim(),
        mobile: editPartyMobile.trim(),
        city: editPartyCity.trim(),
        gst: editPartyGst.trim() || "N/A",
        address: editPartyAddress.trim(),
        paymentTerms: editPartyPaymentTerms,
        updatedAt: serverTimestamp()
      });

      showAlert(`Party "${editPartyName.trim()}" successfully updated in general ledgers.`, null);
      setEditingParty(null);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `parties/${editingParty.partyId}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Toggle Soft Delete
  const handleToggleSoftDeleteParty = async (party: Party) => {
    const actionText = party.isDeleted ? "RESTORE to active state" : "DEACTIVATE (Soft Delete)";
    if (!window.confirm(`Are you sure you want to ${actionText} the party: "${party.partyName}"?`)) return;

    setOpsLoading(true);
    try {
      const partyDocRef = doc(db, "parties", party.partyId);
      await updateDoc(partyDocRef, {
        isDeleted: !party.isDeleted,
        updatedAt: serverTimestamp()
      });

      showAlert(`Party "${party.partyName}" has been successfully ${party.isDeleted ? "restored to active log" : "soft deleted"}.`, null);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `parties/${party.partyId}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Trigger edit form inputs initialization
  const triggerEditParty = (party: Party) => {
    setEditingParty(party);
    setEditPartyName(party.partyName);
    setEditPartyMobile(party.mobile);
    setEditPartyCity(party.city);
    setEditPartyGst(party.gst);
    setEditPartyAddress(party.address);
    setEditPartyPaymentTerms(party.paymentTerms);
  };

  // ==================== END PARTY MASTER OPERATIONS ====================

  // Operation: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm(`Confirm termination of work order order: ${taskId}?`)) return;
    setOpsLoading(true);
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      showAlert(`Work order "${taskId}" permanently decommissioned.`, null);
    } catch (err: any) {
      console.error(err);
      showAlert(null, `Database rejection: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Update Task Status (Shared / Workers)
  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    setOpsLoading(true);
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showAlert(`Work status for "${taskId}" shifted to [${newStatus.toUpperCase()}].`, null);
    } catch (err: any) {
      console.error(err);
      showAlert(null, `Failed update: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Change Worker physical duty Status (For workers)
  const handleUpdateDutyStatus = async (newStatus: WorkerLookup["status"]) => {
    if (!targetWorkerId) return;
    setOpsLoading(true);
    try {
      const workerRef = doc(db, "workers", targetWorkerId);
      await updateDoc(workerRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showAlert(`Shift duty registry modified successfully to ${newStatus.toUpperCase().replace("_", " ")}.`, null);
      if (user) {
        await refreshProfile(user.uid);
      }
    } catch (err: any) {
      console.error(err);
      showAlert(null, `Service transmission error: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Add local inventory item to Masters
  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim() || !newMatStock || !newMatPrice) {
      showAlert(null, "Specify material name, current reserves stock, and unit quote value.");
      return;
    }
    const safeStock = parseInt(newMatStock);
    const safePrice = parseFloat(newMatPrice);
    if (isNaN(safeStock) || isNaN(safePrice)) {
      showAlert(null, "Stock and Price quotes must be strictly digital values.");
      return;
    }

    const newCode = `M-${101 + materialMaster.length}`;
    setMaterialMaster(prev => [
      ...prev,
      { code: newCode, name: newMatName.trim(), stock: safeStock, unit: newMatUnit, section: newMatSection, price: safePrice }
    ]);

    showAlert(`Material catalog entry "${newCode} - ${newMatName}" added successfully.`, null);
    setNewMatName("");
    setNewMatStock("");
    setNewMatPrice("");
  };

  // Operation: Add local invoice transactional ledger
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDesc.trim() || !txAmount) {
      showAlert(null, "Specify payment account entry description and transaction invoice total.");
      return;
    }

    const safeAmount = parseFloat(txAmount);
    if (isNaN(safeAmount) || safeAmount <= 0) {
      showAlert(null, "Invoice quote must be a positive numeric value.");
      return;
    }

    const newTx = {
      id: `TX-${4891 + financeTransactions.length}`,
      category: txCategory,
      description: txDesc.trim(),
      amount: safeAmount,
      type: txType,
      date: new Date().toISOString().split('T')[0]
    };

    setFinanceTransactions(prev => [newTx, ...prev]);
    showAlert(`Invoice ${newTx.id} appended to general finance account ledger.`, null);
    setTxDesc("");
    setTxAmount("");
  };

  // Operation: Generate dynamic printable reports
  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingReport(true);
    setGeneratedReportResult(null);

    setTimeout(() => {
      let filteredTasks = tasks;
      if (reportFilterType !== "all") {
        filteredTasks = tasks.filter(t => t.status === reportFilterType);
      }

      const reportText = `================ ERP SCHEMATIC AUDIT REPORT ================
Generated By: ${userProfile?.displayName} (${role.toUpperCase()})
Query Timestamp: ${new Date().toLocaleString()}
Chronology Bounds: ${reportDateRange.replace("_", " ").toUpperCase()}
Status Scope: ${reportFilterType.toUpperCase()}
-----------------------------------------------------------
1. TASK DISPATCH SUMMARY:
   Total Jobs Under Scope: ${filteredTasks.length}
   - Pending Dispatch: ${filteredTasks.filter(t => t.status === "pending").length}
   - In-Progress: ${filteredTasks.filter(t => t.status === "in_progress").length}
   - Completed Closures: ${filteredTasks.filter(t => t.status === "completed").length}

2. RESOURCE DIRECTORY HEALTH:
   Registered Staff Count: ${users.length}
   Operators On Shift: ${workers.filter(w => w.status === "on_duty").length}
   Idle / Active Registry: ${workers.filter(w => w.status === "active").length}

3. CASH OPERATIONS SUMMARY:
   Gross Operational Invoices: $${financeTransactions.filter(t => t.type === 'income').reduce((acc, c) => acc + c.amount, 0).toLocaleString()}
   Gross Capital Expenditures: $${financeTransactions.filter(t => t.type === 'expense').reduce((acc, c) => acc + c.amount, 0).toLocaleString()}
   Calculated Liquid Margin: $${(financeTransactions.filter(t => t.type === 'income').reduce((acc, c) => acc + c.amount, 0) - financeTransactions.filter(t => t.type === 'expense').reduce((acc, c) => acc + c.amount, 0)).toLocaleString()}

4. SYSTEM HEALTH STATUS: 
   Secure authorization access rules verified. Live subscription syncing to Cloud Firestore database.

*** END OF TRANSMISSION ***`;

      setGeneratedReportResult(reportText);
      setIsGeneratingReport(false);
      showAlert("Enterprise audit report generated. Rendered below for download.", null);
    }, 1200);
  };

  // Calculate high-level stats based on real firebase indices
  const countPending = tasks.filter(t => t.status === "pending").length;
  const countProgress = tasks.filter(t => t.status === "in_progress").length;
  const countCompleted = tasks.filter(t => t.status === "completed").length;
  const totalInvoicedIncome = financeTransactions.filter(t => t.type === "income").reduce((acc, curr) => acc + curr.amount, 0);
  const totalInvoicedExpense = financeTransactions.filter(t => t.type === "expense").reduce((acc, curr) => acc + curr.amount, 0);

  // Quick helper to fetch worker object assigned to a task
  const getAssigneeName = (workerId: string) => {
    const f = workers.find(w => w.workerId === workerId);
    return f ? f.name : `ID: ${workerId}`;
  };

  // Mark all notifications as read
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({...n, read: true})));
  };

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 flex font-sans relative overflow-hidden selection:bg-indigo-500/30 selection:text-white">
      
      {/* Glow Backdrops */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-indigo-650/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[700px] h-[700px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none"></div>

      {/* ==================== 1. SIDEBAR ==================== */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a1128]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 md:static ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Branding Area */}
        <div>
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#080d20]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Layers className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-205 to-slate-400">
                  APEX CORP ERP
                </h1>
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest block leading-none">
                  Operations Suite
                </span>
              </div>
            </div>
            {/* Mobile close toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Connected User Badge */}
          <div className="p-4 mx-3 my-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#131d3f] border-2 border-indigo-500/30 flex items-center justify-center font-extrabold text-[#3a83f1] text-[13px]">
                {userProfile?.displayName ? userProfile.displayName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : "U"}
              </div>
              <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-emerald-500 border-2 border-[#0a1128] rounded-full"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">{userProfile?.displayName || "Connected User"}</p>
              <span className="text-[10px] text-slate-400 block truncate mt-0.5 max-w-[140px] uppercase font-bold tracking-wider">
                👑 {role}
              </span>
            </div>
          </div>

          {/* Interactive Navigation List */}
          <nav className="px-3 space-y-1">
            {[
              { label: "Dashboard", icon: LayoutDashboard },
              { label: "Masters", icon: Database },
              { label: "Orders", icon: ShoppingBag },
              { label: "Grey Stock", icon: Box },
              { label: "Hanks Production", icon: QrCode },
              { label: "Dyeing Production", icon: Layers },
              { label: "Conning Production", icon: Cpu },
              { label: "Ready Stock", icon: Package },
              { label: "Production", icon: Cpu },
              { label: "Dispatch", icon: Truck },
              { label: "Finance", icon: Wallet },
              { label: "Attendance", icon: Calendar },
              { label: "Reports", icon: FileText },
              { label: "Utilities", icon: Shield }
            ].map((menu) => {
              const IconComp = menu.icon;
              const isActive = activeMenu === menu.label;
              return (
                <button
                  key={menu.label}
                  onClick={() => {
                    setActiveMenu(menu.label as MenuType);
                    setIsMobileMenuOpen(false);
                    setSuccessMsg(null);
                    setErrorMsg(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 cursor-pointer text-left ${
                    isActive 
                      ? "bg-gradient-to-r from-indigo-600/30 to-[#3e8eeb]/10 border border-indigo-500/40 text-white font-bold shadow-md shadow-indigo-650/5" 
                      : "text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComp className={`w-4 h-4 transition-transform duration-300 ${isActive ? "text-indigo-400 scale-110" : "text-slate-500Group-hover:text-slate-300"}`} />
                    <span className="text-xs uppercase tracking-wider">{menu.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Security / System status details */}
        <div className="p-4 border-t border-white/5 bg-[#080c1d] space-y-3.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>SECURITY SCOPE</span>
            </div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-5 truncate">
              {role === "owner" ? "Full Operations Write" : role === "manager" ? "Scoped Dispatch/L2" : "Personnel Read-Only"}
            </p>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-650/10 hover:bg-red-600/15 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out Suite
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        ></div>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* ==================== 2. TOP NAVBAR ==================== */}
        <header className="h-16 min-h-16 bg-[#0a1128]/50 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 shadow-lg shadow-black/10">
          
          {/* Left: Mobile Toggle & Router Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer md:hidden text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Path indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-bold">
              <span className="text-slate-500 font-mono text-[10px] tracking-widest uppercase">APEX_ERP</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-indigo-400 uppercase tracking-wider font-extrabold">{activeMenu} Portal</span>
            </div>
          </div>

          {/* Right Layout: Sync Indicators, Notifications panel, Action Menu */}
          <div className="flex items-center gap-3">
            
            {/* DB Synced Indicator */}
            <div className="items-center gap-2 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 text-[10px] text-emerald-400 font-bold tracking-tight hidden md:flex animate-fadeIn transition-colors">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              <Activity className="w-3.5 h-3.5" />
              <span>FIRESTORE CLOUD ACTIVE</span>
            </div>

            {/* Dynamic Interactive Notifications Panel */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer relative text-slate-300 hover:text-white"
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-505 bg-indigo-550 border border-[#080b19] rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3.5 w-80 bg-[#0d1633] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-indigo-400" />
                        Live Feed Alerts ({notifications.filter(n=>!n.read).length})
                      </h4>
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-cyan-400 font-bold hover:underline"
                      >
                        Read All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-2.5 rounded-xl border text-[11px] leading-relaxed transition-all ${
                            n.read 
                              ? "bg-white/[0.01] border-white/5 text-slate-400" 
                              : "bg-indigo-650/10 border-indigo-500/20 text-slate-200 font-medium"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                              n.type === 'success' ? 'text-emerald-400' : n.type === 'alert' ? 'text-amber-400' : 'text-cyan-400'
                            }`}>
                              {n.type}
                            </span>
                            <span className="text-[8px] text-slate-500">{n.time}</span>
                          </div>
                          <span>{n.text}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setIsNotificationsOpen(false)}
                      className="w-full text-center text-[10px] text-slate-400 hover:text-white font-bold block pt-1"
                    >
                      Close Control Drawer
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Action Button for instant testing reports */}
            <button
              onClick={() => setActiveMenu("Reports")}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/15 hidden sm:flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-500/30"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Suite Audit</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* VIEW AREA */}
        <main className="flex-1 p-4 md:p-6 space-y-6 z-10 max-w-7xl w-full mx-auto">
          
          {/* Global Alert Notification Banner */}
          <AnimatePresence>
            {(successMsg || errorMsg) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {successMsg && (
                  <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-500/35 p-4 rounded-2xl text-emerald-300 text-xs shadow-md shadow-emerald-950/10 backdrop-blur-md">
                    <CheckCircle className="w-5 h-5 text-emerald-450 shrink-0" />
                    <span className="font-medium">{successMsg}</span>
                  </div>
                )}
                {errorMsg && (
                  <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/35 p-4 rounded-2xl text-red-350 text-xs shadow-md shadow-red-950/10 backdrop-blur-md animate-shake">
                    <AlertTriangle className="w-5 h-5 text-red-450 shrink-0 mt-0.5" />
                    <span className="font-medium">{errorMsg}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real-time Loader while indexing */}
          {dataLoading && (
            <div className="flex items-center justify-center p-12 bg-white/[0.02] border border-white/10 rounded-2xl gap-3">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-400 font-bold tracking-wider uppercase animate-pulse">Syncing Cloud Registers...</span>
            </div>
          )}

          {/* ============================================================= */}
          {/* ACTIVE ROUTE / TAB RENDER */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMenu}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              
              {/* ==================== SCREEN: DASHBOARD ==================== */}
              {activeMenu === "Dashboard" && (
                <div className="space-y-6">
                  
                  {/* KPI Stat Cards Bento Box */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-indigo-500/20 transition-all group duration-250">
                      <div className="space-y-1">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">STAFF DIRECTORY</span>
                        <p className="text-2xl font-black text-white tracking-tight leading-none">
                          {users.length}
                        </p>
                      </div>
                      <div className="p-3 bg-indigo-500/10 border border-indigo-505 border-indigo-500/20 text-indigo-400 rounded-xl group-hover:bg-indigo-500/15 transition-colors">
                        <UserCheck className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-cyan-500/20 transition-all group duration-250">
                      <div className="space-y-1">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">ON-SHIFT ROSTER</span>
                        <p className="text-2xl font-black text-white tracking-tight leading-none text-cyan-400">
                          {workers.filter(w => w.status === "on_duty").length}
                        </p>
                      </div>
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl group-hover:bg-cyan-500/15 transition-colors">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-amber-500/20 transition-all group duration-250">
                      <div className="space-y-1">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">TASKS ACTIVE</span>
                        <p className="text-2xl font-black text-white tracking-tight leading-none text-amber-400">
                          {countPending + countProgress}
                        </p>
                      </div>
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:bg-amber-500/15 transition-colors">
                        <Briefcase className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-emerald-500/20 transition-all group duration-250">
                      <div className="space-y-1">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">CLOSURE RATE</span>
                        <p className="text-2xl font-black text-white tracking-tight leading-none text-emerald-400">
                          {tasks.length > 0 ? `${Math.round((countCompleted / tasks.length) * 100)}%` : "0%"}
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:bg-emerald-500/15 transition-colors">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>

                  </div>

                  {/* Dashboard Graphic Graphs & Recent Feed */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* SVG Analytics Chart */}
                    <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">OPERATION ANALYTICS</span>
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Production Output Trends</h3>
                        </div>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/5 px-2.5 py-1 rounded-lg border border-cyan-500/15 flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" />
                          <span>+12.4% Target Variance</span>
                        </span>
                      </div>

                      {/* Line graph constructed via pure React SVG for compatibility */}
                      <div className="h-64 w-full relative">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                          </defs>

                          {/* Horizontal Dash Lines */}
                          <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="5,5" />
                          <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="5,5" />
                          <line x1="0" y1="140" x2="500" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="5,5" />
                          <line x1="0" y1="190" x2="500" y2="190" stroke="rgba(255,255,255,0.1)" />

                          {/* Filled area path */}
                          <path 
                            d="M 10,140 Q 90,80 170,110 T 330,40 T 490,60 L 490,190 L 10,190 Z" 
                            fill="url(#chartGradient)" 
                          />

                          {/* Line curve path */}
                          <path 
                            d="M 10,140 Q 90,80 170,110 T 330,40 T 490,60" 
                            fill="none" 
                            stroke="url(#lineColor)" 
                            strokeWidth="3.5" 
                            strokeLinecap="round"
                          />

                          {/* Grid points */}
                          <circle cx="10" cy="140" r="5" fill="#6366f1" stroke="#000" strokeWidth="2" />
                          <circle cx="130" cy="95" r="5" fill="#4f46e5" stroke="#000" strokeWidth="2" />
                          <circle cx="250" cy="75" r="5" fill="#0891b2" stroke="#000" strokeWidth="2" />
                          <circle cx="370" cy="45" r="5" fill="#06b6d4" stroke="#000" strokeWidth="2" />
                          <circle cx="490" cy="60" r="5" fill="#22c55e" stroke="#000" strokeWidth="2" />

                          {/* Label values above points */}
                          <text x="130" y="75" fill="#a5b4fc" fontSize="10" textAnchor="middle" fontWeight="bold">Active Peak</text>
                          <text x="370" y="30" fill="#22d3ee" fontSize="10" textAnchor="middle" fontWeight="bold">92% Cap</text>

                          {/* Horizontal axis label texts */}
                          <text x="10" y="215" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="start">MON</text>
                          <text x="130" y="215" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">WED</text>
                          <text x="250" y="215" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">FRI</text>
                          <text x="370" y="215" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">SAT</text>
                          <text x="490" y="215" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="end">SUN</text>
                        </svg>
                      </div>

                      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 font-bold block">DAILY SHIPMENT QUOTA</span>
                          <span className="text-sm font-black text-white">450 units/day</span>
                        </div>
                        <div className="text-center border-x border-white/5">
                          <span className="text-[10px] text-slate-500 font-bold block">ACTIVE ASSEMBLY LINES</span>
                          <span className="text-sm font-black text-cyan-400">3 Operational</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 font-bold block">WASTAGE RATIO</span>
                          <span className="text-sm font-black text-emerald-450 text-emerald-400">0.82% (Record Low)</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Alerts feed & Mini Map logs */}
                    <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Info className="w-4.5 h-4.5 text-indigo-400" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Line Notifications</h3>
                          </div>
                          <span className="text-[9px] bg-indigo-501 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                            Live updates
                          </span>
                        </div>

                        {/* Stoppages or key updates list */}
                        <div className="space-y-3">
                          <div className="flex gap-2.5 items-start p-2.5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl border border-white/5 transition-all text-xs leading-relaxed">
                            <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <p className="text-slate-300 font-bold">Line A shift rollover complete</p>
                              <span className="text-[9px] text-slate-500 font-mono">Timestamp 12:05 UTC &bull; Operator CLARA</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2.5 items-start p-2.5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl border border-white/5 transition-all text-xs leading-relaxed">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-slate-300 font-bold">Material Low alert registered</p>
                              <span className="text-[9px] text-slate-500 font-mono">Conductive Adhesives &bull; Depot 3B</span>
                            </div>
                          </div>

                          <div className="flex gap-2.5 items-start p-2.5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl border border-white/5 transition-all text-xs leading-relaxed">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-slate-300 font-bold">Order Batch TSK-190 fulfilled</p>
                              <span className="text-[9px] text-slate-500 font-mono">150 silicon plates packaged &bull; Shipment Staged</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* System Info card */}
                      <div className="border border-indigo-500/15 bg-indigo-650/5 p-3 rounded-xl text-[11px] text-slate-400 leading-normal mt-4">
                        <p className="font-bold text-slate-300 flex items-center gap-1 mb-1">
                          <Shield className="w-3.5 h-3.5 text-indigo-455 text-indigo-400" />
                          Security Node Verified
                        </p>
                        Role-based permissions limiting unauthorized mutations. Data is synced in real-time.
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* ==================== SCREEN: MASTERS ==================== */}
              {activeMenu === "Masters" && (
                <div className="space-y-6">
                  
                  {/* Top Header Card */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#0e1633] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-400" />
                        Schema Registry Operations (Master Data)
                      </h2>
                      <p className="text-xs text-slate-400">
                        View, update, add, and query critical master ledgers: Parties, Items, Shades, Machines, and Rates.
                      </p>
                    </div>
                  </div>

                  {/* High Quality Tab selectors */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-1">
                    {[
                      { key: "parties", label: "Party Master", desc: "Clients & Vendors" },
                      { key: "items", label: "Item Master", desc: "Product Inventory specs" },
                      { key: "shades", label: "Shade Master", desc: "Recipe & Color lab codes" },
                      { key: "machines", label: "Machine Master", desc: "Machinery Asset registry" },
                      { key: "rates", label: "Rate Master", desc: "Corporate price matrix" },
                      { key: "workerMaster", label: "Worker Master", desc: "Demographics & Wages" },
                      { key: "workers", label: "Workers & Raw Stocks", desc: "Access Roles & Reserves" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setMastersSubTab(tab.key as any)}
                        className={`px-4 py-3 rounded-xl text-left transition-all relative outline-none flex flex-col gap-0.5 cursor-pointer border ${
                          mastersSubTab === tab.key
                            ? "bg-indigo-600/10 border-indigo-500/35 text-white"
                            : "bg-transparent border-transparent text-slate-400 hover:bg-white/[0.02] hover:text-slate-200"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider">{tab.label}</span>
                        <span className="text-[10px] opacity-70 font-medium leading-none">{tab.desc}</span>
                        {mastersSubTab === tab.key && (
                          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full animate-fadeIn" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Render targeted views */}
                  <div className="animate-fadeIn transition-opacity duration-300">
                    {mastersSubTab === "parties" && (
                      <PartyMasterView role={role} />
                    )}

                    {mastersSubTab === "items" && (
                      <ItemMasterView role={role} />
                    )}

                    {mastersSubTab === "shades" && (
                      <ShadeMasterView role={role} />
                    )}

                    {mastersSubTab === "machines" && (
                      <MachineMasterView role={role} />
                    )}

                    {mastersSubTab === "rates" && (
                      <RateMasterView role={role} />
                    )}

                    {mastersSubTab === "workerMaster" && (
                      <WorkerMasterView role={role} />
                    )}

                    {mastersSubTab === "workers" && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* Material inventory lookup master table */}
                          <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-cyan-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Item Inventory Masters CATALOG</h3>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                                {materialMaster.length} Items Indexed
                              </span>
                            </div>

                            {/* Material Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-wider bg-white/[0.01]">
                                    <th className="py-2.5 px-3">Code</th>
                                    <th className="py-2.5 px-3">Description Name</th>
                                    <th className="py-2.5 px-3 text-right">Category</th>
                                    <th className="py-2.5 px-3 text-right">Raw Stock Reserves</th>
                                    <th className="py-2.5 px-3 text-right">Unit Quote</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-slate-300">
                                  {materialMaster.map((mat) => (
                                    <tr key={mat.code} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{mat.code}</td>
                                      <td className="py-2.5 px-3 font-medium text-white">{mat.name}</td>
                                      <td className="py-2.5 px-3 text-slate-400 text text-[10px] uppercase font-bold text-right">{mat.section}</td>
                                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${mat.stock <= 100 ? "text-amber-450 text-amber-400 animate-pulse" : "text-white"}`}>
                                        {mat.stock.toLocaleString()} {mat.unit}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-indigo-400 font-extrabold">${mat.price}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Add material master form (Only owner/managers can add) */}
                          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Plus className="w-4.5 h-4.5 text-indigo-400" />
                              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Catalog New Material</h3>
                            </div>
                            
                            {role === "worker" ? (
                              <div className="py-6 text-center space-y-2">
                                <Shield className="w-8 h-8 text-red-400 mx-auto opacity-40" />
                                <p className="text-[11px] text-slate-400 leading-normal">
                                  Write Access Restricted. Material creations can only be processed by general system owners or operators.
                                </p>
                              </div>
                            ) : (
                              <form onSubmit={handleAddMaterial} className="space-y-4 text-xs font-sans">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest block font-bold">Material Title</label>
                                  <input 
                                    type="text" 
                                    required
                                    placeholder="e.g., Conductive Copper Foil B"
                                    value={newMatName}
                                    onChange={(e) => setNewMatName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest block font-bold">Initial Reserves</label>
                                    <input 
                                      type="number" 
                                      required
                                      placeholder="e.g., 250"
                                      value={newMatStock}
                                      onChange={(e) => setNewMatStock(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest block font-bold">Unit Designation</label>
                                    <select 
                                      value={newMatUnit}
                                      onChange={(e) => setNewMatUnit(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                                    >
                                      <option value="pcs" className="bg-[#0c1128]">Pcs</option>
                                      <option value="m" className="bg-[#0c1128]">m (Meters)</option>
                                      <option value="kg" className="bg-[#0c1128]">kg (Kilograms)</option>
                                      <option value="L" className="bg-[#0c1128]">L (Liters)</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest block font-bold">Unit Quote Price ($)</label>
                                    <input 
                                      type="number" 
                                      required
                                      step="any"
                                      placeholder="e.g., 24.50"
                                      value={newMatPrice}
                                      onChange={(e) => setNewMatPrice(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-sans"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-450 text-slate-400 uppercase tracking-widest block font-bold">Depot Section</label>
                                    <select 
                                      value={newMatSection}
                                      onChange={(e) => setNewMatSection(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                                    >
                                      <option value="Semiconductors" className="bg-[#0c1128]">Semiconductors</option>
                                      <option value="Conductive Metals" className="bg-[#0c1128]">Conductive Metals</option>
                                      <option value="Chemical Bonding" className="bg-[#0c1128]">Chemical Bonding</option>
                                      <option value="Structural Mounts" className="bg-[#0c1128]">Structural Mounts</option>
                                    </select>
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  className="w-full bg-indigo-650/40 hover:bg-indigo-650/55 border border-indigo-500/35 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Catalog Inventory Record</span>
                                </button>
                              </form>
                            )}
                          </div>

                        </div>

                        {/* Operational Directory & Worker registration segment */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          
                          {/* Interactive Active Worker Registries (Sync database list) */}
                          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-2">
                                <UserCheck className="w-4.5 h-4.5 text-amber-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Worker Directory & Registries</h3>
                              </div>
                              <span className="text-[10px] text-amber-400 bg-amber-500/5 px-2.5 py-1 rounded-full border border-amber-500/15 font-bold">
                                {workers.length} Registered
                              </span>
                            </div>

                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              {workers.map((w) => (
                                <div key={w.workerId} className="flex items-center justify-between p-2.5 bg-white/[0.015] border border-white/5 rounded-xl text-xs hover:border-white/10 transition-colors">
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-white">
                                      <span className="font-mono text-cyan-400 font-extrabold">[{w.workerId}]</span>
                                      <span>{w.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 block font-mono mt-0.5">Secret PIN Mobile: {w.mobileNumber}</span>
                                  </div>
                                  <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                    w.status === "on_duty" 
                                      ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                                      : w.status === "active"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-white/5 border border-white/10 text-slate-500"
                                  }`}>
                                    {w.status.replace("_", " ")}
                                  </span>
                                </div>
                              ))}
                              {workers.length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-xs font-sans">
                                  No active shift registers detected in directory.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Access Registry Form (Owners can add) */}
                          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Plus className="w-4.5 h-4.5 text-emerald-400" />
                              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Register Operations Directory</h3>
                            </div>

                            {(role !== "owner" && role !== "manager") ? (
                              <div className="py-6 text-center space-y-2">
                                <Shield className="w-8 h-8 text-red-400 mx-auto opacity-40" />
                                <p className="text-[11px] text-slate-400 leading-normal">
                                  Operation Rejected. Database registration is strictly scoped under General Manager or Corporate Owner permissions only.
                                </p>
                              </div>
                            ) : (
                              <form onSubmit={handleRegisterUser} className="space-y-4 text-xs font-sans">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider font-bold">Full Legal Name</label>
                                    <input 
                                      type="text"
                                      required
                                      placeholder="Clara Oswald"
                                      value={regName}
                                      onChange={(e) => setRegName(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider font-bold">Corporate Email</label>
                                    <input 
                                      type="email"
                                      required
                                      placeholder="clara@apex.com"
                                      value={regEmail}
                                      onChange={(e) => setRegEmail(e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2.5">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center font-bold">Directory Scope (Access Role)</label>
                                  <div className="grid grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                                    <button
                                      type="button"
                                      onClick={() => setRegRole("worker")}
                                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        regRole === "worker"
                                          ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                                          : "text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      ASSIGNED OPERATOR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRegRole("manager")}
                                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        regRole === "manager"
                                          ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                                          : "text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      MANAGER
                                    </button>
                                  </div>
                                </div>

                                {regRole === "worker" && (
                                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl animate-fadeIn text-[11px]">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-bold">ID (Username PIN)</label>
                                      <input 
                                        type="text"
                                        placeholder="e.g., W-120"
                                        value={regWorkerId}
                                        onChange={(e) => setRegWorkerId(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white uppercase focus:outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-bold">Mobile Secure Pass</label>
                                      <input 
                                        type="text"
                                        placeholder="9012345678"
                                        value={regMobile}
                                        onChange={(e) => setRegMobile(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                )}

                                <button
                                  type="submit"
                                  disabled={opsLoading}
                                  className="w-full bg-emerald-600/35 hover:bg-emerald-600/50 border border-emerald-500/35 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/5"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Register New access node</span>
                                </button>
                              </form>
                            )}
                          </div>

                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ==================== SCREEN: ORDERS ==================== */}
              {activeMenu === "Orders" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#0e1633] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-indigo-400" />
                        Party Purchase Order (PO) Management Module
                      </h2>
                      <p className="text-xs text-slate-400">
                        Record, search, modify, and monitor corporate yarn/product purchase orders mapped with precise count, shade and party attributes.
                      </p>
                    </div>
                  </div>

                  {/* Primary Grid View */}
                  <PartyOrderView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: GREY STOCK ==================== */}
              {activeMenu === "Grey Stock" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#0e1633] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Box className="w-5 h-5 text-cyan-400" />
                        Grey Stock Inward Management Module
                      </h2>
                      <p className="text-xs text-slate-400">
                        Record, search, modify, and monitor raw yarn/product inward grey stock lot receipts. Automatic sequential Lot numbers are assigned, connected to optional party orders.
                      </p>
                    </div>
                  </div>

                  {/* Primary Grid View */}
                  <GreyStockView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: HANKS PRODUCTION ==================== */}
              {activeMenu === "Hanks Production" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#0e1633] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-indigo-400" />
                        Hanks Yarn Processing & Production Module
                      </h2>
                      <p className="text-xs text-slate-400">
                        Record manufacturing steps, assign physical bags with auto-formatted barcode sequence labels, calculate weight loss metrics, and scan/track active hanks processing timelines.
                      </p>
                    </div>
                  </div>

                  {/* Hanks Production View */}
                  <HanksProductionView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: DYEING PRODUCTION ==================== */}
              {activeMenu === "Dyeing Production" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-400" />
                        Dyeing Production & Coloring Module
                      </h2>
                      <p className="text-xs text-slate-400">
                        Manage dyeing runs, chemical recipes, machine asset loading, and employee shifts. Scan hanks bag codes or input manually to fetch and auto-populate client party particulars.
                      </p>
                    </div>
                  </div>

                  {/* Dyeing Production View */}
                  <DyeingProductionView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: CONNING PRODUCTION ==================== */}
              {activeMenu === "Conning Production" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-indigo-400" />
                        Cone Winding (Conning) Production Run & QC Module
                      </h2>
                      <p className="text-xs text-slate-400">
                        Scan dyed lots or hanks box packages using integrated simulated laser terminals. Input wound cone metrics, record weights, verify final quality standard levels, and automate finished goods dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Conning Production View */}
                  <ConningProductionView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: READY STOCK ==================== */}
              {activeMenu === "Ready Stock" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-400" />
                        Ready Stock / Finished Goods Warehouse Ledger
                      </h2>
                      <p className="text-xs text-slate-400">
                        Audit finished goods inventories, racking bins logistics coordinates, packing product categories, and dispatch shipments to customers. Print thermal box shipping decals.
                      </p>
                    </div>
                  </div>

                  {/* Ready Stock View */}
                  <ReadyStockView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: PRODUCTION ==================== */}
              {activeMenu === "Production" && (
                <div className="space-y-6">
                  
                  {/* Production Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#121c3b]/55 border border-white/10 rounded-2xl p-4 space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-[#3cc2ff] uppercase tracking-wider block">LINE A - SILICON BINDINGS</span>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="text-sm font-black text-white hover:underline transition-colors cursor-pointer">Active Running</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-2">Utilization Cap: 94.2% &bull; Temp: 42°C &bull; Target: 1000/hr</p>
                    </div>

                    <div className="bg-[#121c3b]/55 border border-white/10 rounded-2xl p-4 space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-amber-450 text-[#3cc2ff] uppercase tracking-wider block">LINE B - COPPER COIL STAGING</span>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="text-sm font-black text-white">Active Running</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-2">Utilization Cap: 85.0% &bull; Temp: 38°C &bull; Target: 500/hr</p>
                    </div>

                    <div className="bg-[#121c3b]/55 border border-white/10 rounded-2xl p-4 space-y-1 text-xs text-slate-400">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">LINE C - BACKPLATE PACKAGING</span>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-[#64748b] rounded-full"></span>
                        <span className="text-sm font-black text-slate-350">Staged (Idle / Rest)</span>
                      </div>
                      <p className="text-[11px] text-slate-550 font-mono mt-2">Utilization Cap: 0% &bull; Temp: Ambient &bull; Target: 1200/hr</p>
                    </div>
                  </div>

                  {/* Operational dispatch ledgers and form creators */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Dispatch Work Order Form (Managers/Owners) */}
                    <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <Briefcase className="w-4.5 h-4.5 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dispatch New Manufacturing Work Order</h3>
                      </div>

                      {role === "worker" ? (
                        <div className="py-12 bg-white/[0.01] rounded-2xl text-center space-y-2 border border-dashed border-white/5 px-4">
                          <Shield className="w-8 h-8 text-indigo-400 mx-auto opacity-35" />
                          <h4 className="text-xs font-bold text-slate-300">As Operator, Check Your Active Runs Below</h4>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal">
                            Managers emit new structural orders. Locate assigned line quotas under the active task sheet or update state logs.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-sans">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Task Order Title</label>
                            <input 
                              type="text"
                              required
                              placeholder="e.g., Fabricate Site Diodes and Assembly Wire"
                              value={taskTitle}
                              onChange={(e) => setTaskTitle(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requirements Checklist Description</label>
                            <textarea 
                              required
                              rows={3}
                              placeholder="Describe exact coordinates, material quantities (e.g., 50 wafers), and safety steps..."
                              value={taskDesc}
                              onChange={(e) => setTaskDesc(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Work Operator</label>
                            <select 
                              required
                              value={taskAssignee}
                              onChange={(e) => setTaskAssignee(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none cursor-pointer"
                            >
                              <option value="" disabled className="bg-[#0c1128] text-slate-550 text-slate-500">Pick Active Operator...</option>
                              {workers.map((w) => (
                                <option key={w.workerId} value={w.workerId} className="bg-[#0c1128] text-white">
                                  {w.workerId} &bull; {w.name}
                                </option>
                              ))}
                              {workers.length === 0 && (
                                <option disabled className="bg-[#0c1128] text-slate-500">Empty registry. Register workers under Masters.</option>
                              )}
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={opsLoading}
                            className="w-full bg-indigo-650/40 hover:bg-indigo-650/55 border border-indigo-500/35 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-4 h-4 animate-spin-slow" />
                            <span>{opsLoading ? "Broadcasting Queue..." : "Dispatch Work Order"}</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Shared Work active lists (Sync list) */}
                    <div className="space-y-4">
                      
                      {/* Worker duty toggle status box if signed-in as worker */}
                      {role === "worker" && targetWorkerId && (
                        <div className="bg-gradient-to-r from-slate-900 to-[#101d43] border border-white/10 rounded-2xl p-4.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-bold text-indigo-400 uppercase block tracking-wider">DUTY ASSIGNOR</span>
                              <h4 className="text-xs font-bold text-white uppercase">Your Physical Registry Shift Status</h4>
                            </div>
                            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase bg-white/5 px-2.5 py-0.5 rounded-full">
                              {workers.find(w => w.workerId === targetWorkerId)?.status || "Active"}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { label: "On Duty", value: "on_duty" as const, color: "bg-indigo-500/15 border-indigo-500/40 text-indigo-300" },
                              { label: "Active Stby", value: "active" as const, color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
                              { label: "Off Duty/Signout", value: "off_duty" as const, color: "bg-white/5 border-white/10 text-slate-400" }
                            ].map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                onClick={() => handleUpdateDutyStatus(st.value)}
                                className={`py-2 rounded-xl border text-[10px] font-bold text-center cursor-pointer transition-all hover:brightness-110 ${st.color}`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Jobs Database Ledger */}
                      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/14 border-white/10 rounded-2xl p-5 shadow-lg space-y-4 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-4 h-4 text-indigo-451 text-indigo-400" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Manufacturing Ledger list</h3>
                          </div>
                          <span className="text-[10px] font-mono text-indigo-453 text-indigo-450 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 font-bold">
                            {tasks.length} Dispatched
                          </span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {tasks.map((task) => {
                            const isMyTask = task.assignedWorkerId === targetWorkerId;
                            return (
                              <div key={task.taskId} className="bg-white/[0.01] hover:bg-white/[0.025] border border-white/5 hover:border-white/10 p-3.5 rounded-xl space-y-2.5 transition-all text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[9px] font-bold text-cyan-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">{task.taskId}</span>
                                    <h4 className="font-bold text-white leading-tight">{task.title}</h4>
                                  </div>
                                  <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded border ${
                                    task.status === "completed" 
                                      ? "bg-emerald-550/10 border border-emerald-500/25 text-emerald-400" 
                                      : task.status === "in_progress"
                                        ? "bg-indigo-501 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400"
                                        : "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                                  }`}>
                                    {task.status.replace("_", " ")}
                                  </span>
                                </div>
                                
                                <p className="text-[11px] text-slate-400 leading-normal">{task.description}</p>
                                
                                <div className="flex items-center justify-between border-t border-white/5 pt-2 flex-wrap gap-2 text-[10px] text-slate-400">
                                  <span>Operator: <strong className="text-white">{getAssigneeName(task.assignedWorkerId)}</strong> ({task.assignedWorkerId})</span>
                                  
                                  {/* Actions block depends on user role */}
                                  <div className="flex items-center gap-1.5">
                                    {role === "worker" && isMyTask ? (
                                      <div className="flex items-center gap-1">
                                        {task.status === "pending" && (
                                          <button
                                            onClick={() => handleUpdateTaskStatus(task.taskId, "in_progress")}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[9px] cursor-pointer"
                                          >
                                            Start Job
                                          </button>
                                        )}
                                        {task.status === "in_progress" && (
                                          <button
                                            onClick={() => handleUpdateTaskStatus(task.taskId, "completed")}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[9px] cursor-pointer"
                                          >
                                            Deliver / Fulfill
                                          </button>
                                        )}
                                      </div>
                                    ) : role !== "worker" ? (
                                      <div className="flex items-center gap-1">
                                        {task.status !== "completed" && (
                                          <button
                                            onClick={() => handleUpdateTaskStatus(task.taskId, "completed")}
                                            className="p-1 px-2 border border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400 rounded text-[9px] transition-colors cursor-pointer"
                                            title="Mark Complete"
                                          >
                                            Fulfill Run
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteTask(task.taskId)}
                                          className="p-1 border border-white/10 hover:bg-red-500/10 text-slate-450 hover:text-red-400 rounded transition-colors cursor-pointer"
                                          title="Decommission Order"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {tasks.length === 0 && (
                            <div className="text-center py-10 bg-white/[0.015] border border-dashed border-white/10 rounded-xl text-slate-500 font-sans text-xs">
                              No active assembly runs or dispatches scheduled.
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* ==================== SCREEN: DISPATCH ==================== */}
              {activeMenu === "Dispatch" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Truck className="w-5 h-5 text-indigo-400" />
                        Commercial Invoiced Dispatch Logistics
                      </h2>
                      <p className="text-xs text-slate-400">
                        Capture finished goods dispatch orders, specify yarn weights, fetch rate specifications, note transport carrier details and print professional invoices.
                      </p>
                    </div>
                  </div>

                  <DispatchView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: FINANCE ==================== */}
              {activeMenu === "Finance" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-indigo-400" />
                        Accounts Ledger, Payrolls & Wages
                      </h2>
                      <p className="text-xs text-slate-400">
                        Audit party-wise credit ledgers, log payment receipts, clear worker weekly wages (Pagar), issue advances (Upaad draws), and manage long-term loans.
                      </p>
                    </div>
                  </div>

                  {/* Sub-navigation buttons split */}
                  <div className="flex border-b border-white/10 gap-2 mb-4">
                    <button
                      onClick={() => setFinanceSubTab("client")}
                      className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        financeSubTab === "client" 
                          ? "border-indigo-505 border-indigo-500 text-white font-black" 
                          : "border-transparent text-slate-400 hover:text-white"
                      }`}
                    >
                      Customer accounts & collections
                    </button>
                    <button
                      onClick={() => setFinanceSubTab("worker")}
                      className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                        financeSubTab === "worker"
                          ? "border-indigo-505 border-indigo-500 text-white font-black"
                          : "border-transparent text-slate-400 hover:text-white"
                      }`}
                    >
                      Worker payroll & pager sheets
                    </button>
                  </div>

                  {financeSubTab === "client" ? (
                    <FinanceView role={role} />
                  ) : (
                    <WorkerFinanceView role={role} />
                  )}
                </div>
              )}

              {/* ==================== SCREEN: ATTENDANCE ==================== */}
              {activeMenu === "Attendance" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-400" />
                        Worker Attendance & Daily Roster Board
                      </h2>
                      <p className="text-xs text-slate-400">
                        Record daily worker status (Present, Half Day, Absent, Leave) to dynamically compute daily wage rates, auto-compile monthly wage sheets, and audit factory shift attendances.
                      </p>
                    </div>
                  </div>

                  <AttendanceView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: REPORTS ==================== */}
              {activeMenu === "Reports" && (
                <div className="space-y-6">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        Comprehensive ERP manufacturing Reports
                      </h2>
                      <p className="text-xs text-slate-400">
                        View party transactions, fiber items, worker productivity logs, machine capacity loads, dispatches summaries, and cash receipts. Export any ledger or roster as clean Microsoft Excel sheets or PDF printouts.
                      </p>
                    </div>
                  </div>

                  <ReportsView role={role} />
                </div>
              )}

              {/* ==================== SCREEN: UTILITIES ==================== */}
              {activeMenu === "Utilities" && (
                <div className="space-y-6">
                  {/* Screen Header */}
                  <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        ERP Admin logs & Disaster Backup Console
                      </h2>
                      <p className="text-xs text-slate-400">
                        Trace operations logs in administrative audit records, run a complete offline backup of your Firestore cloud parameters, or upload a JSON backup snapshot file to restore system configurations.
                      </p>
                    </div>
                  </div>

                  <SystemUtilitiesView role={role} />
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </main>

      </div>
    </div>
  );
};

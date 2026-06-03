export type UserRole = "owner" | "manager" | "worker";

export interface UserProfile {
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
  workerId?: string; // set only if role === 'worker'
  createdAt: any;
  updatedAt: any;
}

export interface PrivateInfo {
  email: string;
  mobileNumber: string;
  updatedAt: any;
}

export interface WorkerLookup {
  workerId: string;
  mobileNumber: string;
  userId: string;
  name: string;
  status: "active" | "on_duty" | "off_duty";
  createdAt: any;
  updatedAt: any;
}

export interface Task {
  taskId: string;
  title: string;
  description: string;
  assignedWorkerId: string; // WorkerID if worker
  createdBy: string; // User Name or UserID of Owner/Manager
  status: "pending" | "in_progress" | "completed";
  createdAt: any;
  updatedAt: any;
}

export interface Party {
  partyId: string;
  partyName: string;
  mobile: string;
  city: string;
  gst: string;
  address: string;
  paymentTerms: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Item {
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  description: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Shade {
  shadeId: string;
  shadeName: string;
  shadeCode: string;
  description: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Machine {
  machineId: string;
  machineName: string;
  machineCode: string;
  capacity: string;
  machineType: string;
  status: "active" | "inactive" | "maintenance";
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Rate {
  rateId: string;
  partyId: string;
  itemId: string;
  shadeId: string; // can be "none" or specific shade ID
  rate: number;
  effectiveDate: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface WorkerMaster {
  workerId: string;
  workerName: string;
  mobile: string;
  address: string;
  unit: string;
  role: string;
  rate: number;
  isDeleted: boolean;
  workerType?: "Piece Rate" | "Daily Wage";
  facePhoto?: string; // Base64 data URI of registered face
  createdAt: any;
  updatedAt: any;
}

export interface PartyOrder {
  orderId: string;         // e.g. ORD-0001, ORD-0002...
  partyId: string;
  partyName: string;
  poNumber: string;
  itemId: string;
  itemName: string;
  count: string;
  shadeId: string;
  shadeName: string;
  qtyKg: number;
  rate: number;
  deliveryDate: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Pending" | "Processing" | "Completed" | "Cancelled";
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface GreyStock {
  lotId: string;          // Auto-generated sequential ID, e.g. L-001, L-002...
  date: string;           // Received date
  challanNo: string;     // Challan specification reference
  partyId: string;        // Linked party identity code
  partyName: string;      // Cached party name
  orderId: string;        // Associated order ID reference (e.g. ORD-0001) or "manual"
  itemId: string;         // Linked product item catalog code
  itemName: string;       // Cached catalog product title
  count: string;          // Count specifications
  receivedQtyKg: number;  // Numeric conversion weight in Kilograms
  conesBags: number;      // Packaged units count
  isDeleted: boolean;     // Soft delete status marker
  createdAt: any;
  updatedAt: any;
}

export interface HanksProduction {
  productionId: string;    // Unique primary document ID, e.g. HP-0001
  lotId: string;           // Linked lot number from grey stock, e.g. L-001
  bagNo: string;           // Auto generated sequential bag, e.g. L-001-B01
  workerId: string;        // Linked worker ID from worker masters
  workerName: string;      // Cached worker name
  process: string;         // Name of the process (e.g. Reeling, Winding)
  inputKg: number;         // Input raw grey weight
  outputKg: number;        // Output finished hanks weight
  lossPercent: number;     // Process wastage loss ratio %
  status: "Pending" | "Processing" | "Completed" | "Approved";
  isDeleted: boolean;      // Soft delete flag
  createdAt: any;
  updatedAt: any;
}

export interface DyeingProduction {
  dyeingId: string;        // Unique primary document ID, e.g. DP-0001
  lotId: string;           // Linked lot number from Hanks / Grey stock, e.g. L-001
  bagNo: string;           // Autoregistered bag reference code e.g. L-001-B01
  partyName: string;       // Cached supplier or client name
  shade: string;           // Shade Code/Specs
  recipe: string;          // Chemical/Dyeing Recipe prescription ID or details
  machine: string;         // Linked machine label/unit code
  operatorId: string;      // Associated Operator worker ID
  operatorName: string;    // Associated Operator name
  helperId: string;        // Associated Helper worker ID
  helperName: string;      // Associated Helper name
  inputKg: number;         // Feed weight in Kg (usually autofetched from Bag weight)
  outputKg: number;        // Exit dyed weight in Kg after processing
  lossPercent: number;     // Calculated waste loss %
  status: "Pending" | "Running" | "Completed" | "Rework" | "Rejected";
  isDeleted: boolean;      // Soft archive marker
  createdAt: any;
  updatedAt: any;
}

export interface ConningProduction {
  conningId: string;       // Unique primary document ID, e.g. CP-0001
  lotId: string;           // Linked lot number, e.g. L-001
  bagNo: string;           // Autoregistered bag reference e.g. L-001-B01 or Dye Run ID
  partyName: string;       // Client or supplier party name
  shade: string;           // Shade Code/Specs
  coneWeight: number;      // Individual or target Cone weight in Kg, e.g. 1.15
  conesCount: number;      // Total wound cones count
  outputKg: number;        // Total physical exit weight, e.g. coneWeight * conesCount
  quality: "Pass" | "Reject"; // Final inspection quality tier
  status: "Pending" | "Processing" | "Completed"; // Running/fulfillment phase
  isDeleted: boolean;      // Soft archive marker
  createdAt: any;
  updatedAt: any;
}

export interface ReadyStock {
  stockId: string;         // Unique Primary Document Key, e.g. RS-0001
  lotId: string;           // Referenced Lot ID e.g. L-001
  bagNo: string;           // Reference sequence bag e.g. L-001-B01
  partyName: string;       // Derived Client Party Name
  shade: string;           // Target Shade code
  conesCount: number;      // Count unit in package
  weightKg: number;        // Finished weight in Kg
  grade: "A Grade" | "Standard Grade" | "B Grade"; // Packing grade reference
  warehouseLocation: string; // Storage racking location
  status: "Available" | "Reserved" | "Dispatched"; // Fulfilling states
  conningIdReference?: string; // Sibling link back to wind/conning batch
  isDeleted: boolean;      // Soft archive marker
  createdAt: any;
  updatedAt: any;
}

export interface DispatchTransaction {
  dispatchId: string;      // Unique sequential ID, e.g. DISP-0001
  invoiceNo: string;       // Invoice Number, e.g. INV-2026-001
  partyId: string;         // Linked Party ID
  partyName: string;       // Party Name
  orderId: string;         // Referenced Party Order ID, or "Manual"
  lotId: string;           // Linked Lot Reference
  itemName: string;        // Item name (e.g. Cotton 40s)
  shade: string;           // Color shade
  dispatchKg: number;      // Billable Weight in Kg
  rate: number;            // Rate per Kg
  amount: number;          // Total amount = dispatchKg * rate
  vehicleNo: string;       // Vehicle transport number
  lrNo: string;            // Transport LR / consignment note number
  status: "Pending" | "Dispatched" | "Cancelled";
  isDeleted: boolean;      // Soft archive marker
  createdAt: any;
  updatedAt: any;
}

export interface PaymentCollection {
  paymentId: string;       // Unique sequential ID, e.g. COLL-0001
  partyId: string;         // Linked Party ID
  partyName: string;       // Party Name
  paymentDate: string;     // Date of payment, e.g. YYYY-MM-DD
  mode: "Cash" | "UPI" | "Bank Transfer" | "Cheque"; // Payment mode
  referenceNo: string;     // Transaction ID, UPI ref or Cheque Number
  amount: number;          // Received amount in INR
  notes: string;           // Internal auditing remarks
  isDeleted: boolean;      // Soft archive marker
  createdAt: any;
  updatedAt: any;
}

export interface LedgerAdjustment {
  adjustmentId: string;    // Unique ID, e.g. ADJ-0001
  partyId: string;         // Linked Party ID
  partyName: string;       // Party Name
  date: string;            // Date of entry
  type: "Debit" | "Credit"; // Debit = Party owes us more; Credit = Party paid/credit note
  particulars: string;     // Transaction description
  amount: number;          // Adjustment amount
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WorkerUpaad {
  upaadId: string;
  workerId: string;
  workerName: string;
  date: string;
  amount: number;
  particulars: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WorkerLoan {
  loanId: string;
  workerId: string;
  workerName: string;
  date: string;
  loanAmount: number;
  haptaAmount: number;
  totalPaid: number;
  outstanding: number;
  particulars: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WorkerHapta {
  haptaId: string;
  loanId: string;
  workerId: string;
  workerName: string;
  date: string;
  amount: number;
  remarks: string;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WorkerPagar {
  pagarId: string;
  workerId: string;
  workerName: string;
  periodStart: string;
  periodEnd: string;
  hanksKg: number;
  hanksWages: number;
  dyeingBatches: number;
  dyeingWages: number;
  conningCones: number;
  conningWages: number;
  attendancePresentDays?: number;
  attendanceHalfDays?: number;
  attendanceAbsentDays?: number;
  attendanceLeaveDays?: number;
  attendanceWages?: number;
  grossWages: number;
  upaadDeducted: number;
  loanDeducted: number;
  bonusAmount: number;
  netWages: number;
  status: "Pending" | "Paid";
  paidDate: string;
  paymentMode: "Cash" | "Bank Transfer" | "UPI";
  createdAt: any;
  updatedAt: any;
}

export interface WorkerAttendance {
  attendanceId: string;
  workerId: string;
  workerName: string;
  date: string; // YYYY-MM-DD
  status: "Present" | "Absent" | "Half Day" | "Leave";
  dailyRate: number;
  earnedAmount: number;
  isDeleted: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AuditLog {
  logId?: string;
  action: string;
  details: string;
  userEmail: string;
  timestamp: any;
}






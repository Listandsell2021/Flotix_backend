// User & Auth Types
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER'
}

// Permission Types
export enum Permission {
  // Company Management
  COMPANY_CREATE = 'COMPANY_CREATE',
  COMPANY_READ = 'COMPANY_READ',
  COMPANY_UPDATE = 'COMPANY_UPDATE',
  COMPANY_DELETE = 'COMPANY_DELETE',
  
  // User Management
  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_ASSIGN_ROLE = 'USER_ASSIGN_ROLE',
  
  // Driver Management
  DRIVER_CREATE = 'DRIVER_CREATE',
  DRIVER_READ = 'DRIVER_READ',
  DRIVER_UPDATE = 'DRIVER_UPDATE',
  DRIVER_DELETE = 'DRIVER_DELETE',
  
  // Vehicle Management
  VEHICLE_CREATE = 'VEHICLE_CREATE',
  VEHICLE_READ = 'VEHICLE_READ',
  VEHICLE_UPDATE = 'VEHICLE_UPDATE',
  VEHICLE_DELETE = 'VEHICLE_DELETE',
  VEHICLE_ASSIGN = 'VEHICLE_ASSIGN',
  
  // Expense Management
  EXPENSE_CREATE = 'EXPENSE_CREATE',
  EXPENSE_READ = 'EXPENSE_READ',
  EXPENSE_UPDATE = 'EXPENSE_UPDATE',
  EXPENSE_DELETE = 'EXPENSE_DELETE',
  EXPENSE_APPROVE = 'EXPENSE_APPROVE',
  EXPENSE_EXPORT = 'EXPENSE_EXPORT',
  
  // Reports & Analytics
  REPORT_VIEW = 'REPORT_VIEW',
  REPORT_EXPORT = 'REPORT_EXPORT',
  DASHBOARD_VIEW = 'DASHBOARD_VIEW',
  
  // System Management
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS',
  AUDIT_LOG_VIEW = 'AUDIT_LOG_VIEW',
  ROLE_MANAGEMENT = 'ROLE_MANAGEMENT'
}

type CompanyIdType = string | { _id?: string; id?: string } | null;

export interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // System roles cannot be deleted
  companyId?: CompanyIdType; // Custom roles are company-specific
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  companyId?: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}


export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole; // Primary role for backward compatibility
  roles?: string[]; // Multiple custom roles
  permissions?: Permission[]; // Computed permissions from all roles
  companyId?: CompanyIdType;
  assignedVehicleId?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
  assignedVehicleId?: string;
}

// Vehicle Types
export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED'
}

export enum VehicleType {
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  VAN = 'VAN',
  MOTORCYCLE = 'MOTORCYCLE'
}

export interface Vehicle {
  _id: string;
  companyId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  type: VehicleType;
  status: VehicleStatus;
  currentOdometer: number; // in kilometers
  assignedDriverId?: string; // Primary driver (for backward compatibility)
  assignedDriverIds?: string[]; // Multiple drivers
  fuelType?: string;
  color?: string;
  purchaseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleRequest {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  type: VehicleType;
  currentOdometer: number;
  fuelType?: string;
  color?: string;
  purchaseDate?: Date;
}

export interface AssignVehicleRequest {
  driverId: string;
}

// Company Types
export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED'
}

export enum CompanyPlan {
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export interface Company {
  _id: string;
  name: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  driverLimit: number;
  createdAt: Date;
  updatedAt: Date;
  renewalDate: Date;
}

// Expense Types
export enum ExpenseType {
  FUEL = 'FUEL',
  MISC = 'MISC'
}

export enum ExpenseCategory {
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  REPAIR = 'REPAIR',
  OTHER = 'OTHER'
}

export interface Expense {
  _id: string;
  driverId: string;
  companyId: string;
  vehicleId?: string;
  type: ExpenseType;
  amountExtracted?: number; // OCR extracted amount
  amountFinal: number; // Final amount (user confirmed/edited)
  currency: string;
  receiptUrl: string;
  category?: ExpenseCategory;
  notes?: string;
  merchant?: string;
  kilometers?: number; // Distance traveled in kilometers
  odometerReading?: number; // Current odometer reading after trip
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
}

export interface CreateExpenseRequest {
  driverId?: string; // Optional: used when admin creates expense for a driver
  type: ExpenseType;
  amountFinal: number;
  currency: string;
  receiptUrl: string;
  category?: ExpenseCategory;
  notes?: string;
  kilometers?: number;
  odometerReading?: number;
  date: Date;
}

// OCR Types
export interface OCRResult {
  merchant: string | null;
  date: string | null; // YYYY-MM-DD format
  currency: string | null; // ISO 4217
  amount: number | null;
  confidence: number; // 0-1
}

// Audit Log Types
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT'
}

export enum AuditModule {
  USER = 'USER',
  COMPANY = 'COMPANY',
  EXPENSE = 'EXPENSE',
  REPORT = 'REPORT',
  AUTH = 'AUTH',
  VEHICLE = 'VEHICLE'
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface AuditLog {
  _id: string;
  timestamp: Date;
  userId: string;
  role: UserRole;
  companyId?: string;
  action: AuditAction;
  module: AuditModule;
  referenceIds: Record<string, string>;
  status: AuditStatus;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash'>;
  tokens: AuthTokens;
  driverData?: {
    assignedVehicle?: Vehicle;
    company?: Company;
    recentExpenses?: any[];
    expenseStats?: any;
  };
}

// Filter/Search Types
export interface ExpenseFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: ExpenseType;
  driverId?: string;
  category?: ExpenseCategory;
  amountMin?: number;
  amountMax?: number;
  search?: string; // merchant/notes search
}

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  driverId?: string;
  type?: ExpenseType;
  category?: ExpenseCategory;
  groupBy?: 'driver' | 'category' | 'month' | 'type';
}

// Dashboard/Analytics Types
export interface DashboardKPIs {
  totalSpendThisMonth: number;
  fuelVsMiscSplit: {
    fuel: number;
    misc: number;
  };
  topDriversBySpend: Array<{
    driverId: string;
    driverName: string;
    totalSpend: number;
  }>;
  monthOverMonthTrend: {
    currentMonth: number;
    previousMonth: number;
    percentageChange: number;
  };
}

export interface ReportData {
  summary: {
    totalAmount: number;
    expenseCount: number;
    avgExpenseAmount: number;
  };
  breakdown: Array<{
    label: string;
    value: number;
    count: number;
  }>;
  chartData: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
}
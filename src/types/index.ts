// User Types
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER'
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
  password?: string;
  role: UserRole;
  status: UserStatus;
  companyId?: string;
  assignedVehicleId?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  renewalDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Vehicle Types
export enum VehicleType {
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  VAN = 'VAN',
  MOTORCYCLE = 'MOTORCYCLE'
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED'
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
  currentOdometer: number;
  assignedDriverId?: string;
  assignedDriverIds?: string[];
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
  driverId?: string;
  driverIds?: string[];
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
  companyId: string;
  driverId: string;
  type: ExpenseType;
  amountFinal: number;
  currency: string;
  receiptUrl: string;
  merchant?: string;
  category?: ExpenseCategory;
  notes?: string;
  kilometers?: number;
  odometerReading?: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;

  // OCR related fields
  amountOcr?: number;
  merchantOcr?: string;
  dateOcr?: Date;
  ocrConfidence?: number;
  isEditedAfterOcr?: boolean;
  editedAt?: Date;
}

export interface CreateExpenseRequest {
  driverId?: string;
  type: ExpenseType;
  amountFinal: number;
  currency: string;
  receiptUrl: string;
  merchant?: string;
  category?: ExpenseCategory;
  notes?: string;
  kilometers?: number;
  odometerReading?: number;
  date: Date;
}

// Role Types
export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleAssignment {
  _id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
}

// Audit Log Types
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ASSIGN = 'ASSIGN',
  UNASSIGN = 'UNASSIGN'
}

export enum AuditModule {
  USER = 'USER',
  COMPANY = 'COMPANY',
  VEHICLE = 'VEHICLE',
  EXPENSE = 'EXPENSE',
  ROLE = 'ROLE',
  AUTH = 'AUTH',
  REPORT = 'REPORT',
  SYSTEM = 'SYSTEM'
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING'
}

export interface AuditLog {
  _id: string;
  userId: string;
  userEmail: string;
  companyId?: string;
  action: AuditAction;
  module: AuditModule;
  status: AuditStatus;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId?: string;
  iat?: number;
  exp?: number;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
  assignedVehicleId?: string;
}

export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
}

// Firebase Types
export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  storageBucket: string;
}

// OCR Types
export interface OcrResult {
  merchant?: string;
  amount?: number;
  date?: Date;
  currency?: string;
  confidence: number;
  rawText: string;
}

// Report Types
export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  driverId?: string;
  type?: ExpenseType;
  category?: ExpenseCategory;
  groupBy?: 'driver' | 'category' | 'month' | 'type';
}

export interface DashboardStats {
  totalExpenses: number;
  totalAmount: number;
  monthlyAmount: number;
  fuelExpenses: number;
  miscExpenses: number;
  activeDrivers: number;
  totalVehicles: number;
  assignedVehicles: number;
}

export interface DashboardKPIs {
  totalExpenses: number;
  totalAmount: number;
  monthlySpend: number;
  averagePerExpense: number;
  fuelVsMisc: {
    fuel: number;
    misc: number;
  };
  topDrivers: Array<{
    driverId: string;
    driverName: string;
    totalAmount: number;
    expenseCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
}

export interface ReportData {
  summary: {
    totalAmount: number;
    totalExpenses: number;
    averageAmount: number;
  };
  breakdown: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  timeline: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
}

export interface ExpenseFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: ExpenseType;
  category?: ExpenseCategory;
  driverId?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Express Request Extensions
export interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    role: UserRole;
    companyId?: string;
  };
}

// Permission Types
export enum Permission {
  // User permissions
  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_MANAGE_ROLES = 'USER_MANAGE_ROLES',

  // Company permissions
  COMPANY_CREATE = 'COMPANY_CREATE',
  COMPANY_READ = 'COMPANY_READ',
  COMPANY_UPDATE = 'COMPANY_UPDATE',
  COMPANY_DELETE = 'COMPANY_DELETE',

  // Vehicle permissions
  VEHICLE_CREATE = 'VEHICLE_CREATE',
  VEHICLE_READ = 'VEHICLE_READ',
  VEHICLE_UPDATE = 'VEHICLE_UPDATE',
  VEHICLE_DELETE = 'VEHICLE_DELETE',
  VEHICLE_ASSIGN = 'VEHICLE_ASSIGN',

  // Expense permissions
  EXPENSE_CREATE = 'EXPENSE_CREATE',
  EXPENSE_READ = 'EXPENSE_READ',
  EXPENSE_UPDATE = 'EXPENSE_UPDATE',
  EXPENSE_DELETE = 'EXPENSE_DELETE',
  EXPENSE_APPROVE = 'EXPENSE_APPROVE',

  // Report permissions
  REPORT_VIEW = 'REPORT_VIEW',
  REPORT_EXPORT = 'REPORT_EXPORT',

  // System permissions
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  AUDIT_READ = 'AUDIT_READ',
}

export interface PermissionDetails {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Configuration Types
export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  allowedOrigins: string[];
  openaiApiKey: string;
  openaiModel: string;
  firebase: FirebaseConfig;
  maxFileSize: number;
  allowedFileTypes: string[];
  expenseEditTimeLimit: number;
  defaultDriverLimit: number;
  exportMaxRecords: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}
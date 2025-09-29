import { Router } from 'express';
import mongoose from 'mongoose';
import { 
  authenticate, 
  checkRole,
  checkCompanyAccess,
  validate,
  reportFiltersSchema,
  auditReportExport,
  asyncHandler
} from '../middleware';
import { Expense } from '../models';
import type { 
  UserRole, 
  ApiResponse,
  ReportData,
  ReportFilters,
  DashboardKPIs
} from '../types';

const router = Router();

// GET /api/reports/dashboard
router.get('/dashboard',
  authenticate,
  checkRole(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER']),
  asyncHandler(async (req: any, res) => {
    const { companyId, role } = req.user;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Build query based on user role - convert companyId to ObjectId for proper comparison
    const baseQuery = role === 'SUPER_ADMIN' ? {} : { companyId: new mongoose.Types.ObjectId(companyId) };

    // Get KPIs
    const [
      totalSpendThisMonth,
      lastMonthSpend,
      fuelVsMiscSplit,
      topDrivers
    ] = await Promise.all([
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amountFinal' } } }
      ]),
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: lastMonth, $lt: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amountFinal' } } }
      ]),
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: thisMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amountFinal' } } }
      ]),
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: thisMonth } } },
        { $group: { _id: '$driverId', total: { $sum: '$amountFinal' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driver' } }
      ])
    ]);

    const currentTotal = totalSpendThisMonth[0]?.total || 0;
    const previousTotal = lastMonthSpend[0]?.total || 0;
    const percentageChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    const fuelTotal = fuelVsMiscSplit.find(item => item._id === 'FUEL')?.total || 0;
    const miscTotal = fuelVsMiscSplit.find(item => item._id === 'MISC')?.total || 0;

    const kpis: DashboardKPIs = {
      totalSpendThisMonth: currentTotal,
      fuelVsMiscSplit: {
        fuel: fuelTotal,
        misc: miscTotal
      },
      topDriversBySpend: topDrivers.map(item => ({
        driverId: item._id.toString(),
        driverName: item.driver[0]?.name || 'Unknown',
        totalSpend: item.total
      })),
      monthOverMonthTrend: {
        currentMonth: currentTotal,
        previousMonth: previousTotal,
        percentageChange
      }
    };

    res.json({
      success: true,
      data: kpis,
      message: 'Dashboard data retrieved successfully'
    } as ApiResponse<DashboardKPIs>);
  })
);

// GET /api/reports/summary
router.get('/summary',
  authenticate,
  checkRole(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER']),
  validate(reportFiltersSchema),
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const filters: ReportFilters = req.query;
    
    const query: any = { companyId: new mongoose.Types.ObjectId(companyId) };
    query.date = {
      $gte: new Date(filters.dateFrom),
      $lte: new Date(filters.dateTo)
    };

    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.driverId) query.driverId = filters.driverId;

    const [summary, breakdown, chartData] = await Promise.all([
      Expense.aggregate([
        { $match: query },
        { $group: {
          _id: null,
          totalAmount: { $sum: '$amountFinal' },
          expenseCount: { $sum: 1 },
          avgExpenseAmount: { $avg: '$amountFinal' }
        }}
      ]),
      Expense.aggregate([
        { $match: query },
        { $group: {
          _id: filters.groupBy === 'driver' ? '$driverId' : 
               filters.groupBy === 'category' ? '$category' :
               filters.groupBy === 'type' ? '$type' : 
               { $dateToString: { format: "%Y-%m", date: "$date" } },
          value: { $sum: '$amountFinal' },
          count: { $sum: 1 }
        }},
        { $sort: { value: -1 } }
      ]),
      Expense.aggregate([
        { $match: query },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          amount: { $sum: '$amountFinal' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const reportData: ReportData = {
      summary: summary[0] || { totalAmount: 0, expenseCount: 0, avgExpenseAmount: 0 },
      breakdown: breakdown.map(item => ({
        label: item._id?.toString() || 'Unknown',
        value: item.value,
        count: item.count
      })),
      chartData: chartData.map(item => ({
        date: item._id,
        amount: item.amount,
        count: item.count
      }))
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Report data retrieved successfully'
    } as ApiResponse<ReportData>);
  })
);

export { router as reportRoutes };
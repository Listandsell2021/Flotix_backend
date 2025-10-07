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
import { Expense, User } from '../models';
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

    // Get total active drivers count for the company
    const driverCountQuery = role === 'SUPER_ADMIN'
      ? { role: 'DRIVER', status: 'ACTIVE' }
      : { companyId: new mongoose.Types.ObjectId(companyId), role: 'DRIVER', status: 'ACTIVE' };

    // Get KPIs with enhanced metrics
    const [
      totalSpendThisMonth,
      lastMonthSpend,
      fuelVsMiscSplit,
      topDrivers,
      totalActiveDrivers,
      expenseCount,
      totalDriversWithExpenses
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
      ]),
      User.countDocuments(driverCountQuery),
      Expense.countDocuments({ ...baseQuery, date: { $gte: thisMonth } }),
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: thisMonth } } },
        { $group: { _id: '$driverId' } },
        { $count: 'total' }
      ])
    ]);

    const currentTotal = totalSpendThisMonth[0]?.total || 0;
    const previousTotal = lastMonthSpend[0]?.total || 0;
    const percentageChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    const fuelTotal = fuelVsMiscSplit.find(item => item._id === 'FUEL')?.total || 0;
    const miscTotal = fuelVsMiscSplit.find(item => item._id === 'MISC')?.total || 0;
    const driversWithExpenses = totalDriversWithExpenses[0]?.total || 0;

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
      },
      totalActiveDrivers,
      expenseCountThisMonth: expenseCount,
      driversWithExpensesThisMonth: driversWithExpenses,
      averageExpensePerDriver: driversWithExpenses > 0 ? currentTotal / driversWithExpenses : 0
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

// GET /api/reports/trends - Monthly trend data for charts
router.get('/trends',
  authenticate,
  checkRole(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER']),
  asyncHandler(async (req: any, res) => {
    const { companyId, role } = req.user;
    const { months = 6 } = req.query;

    const baseQuery = role === 'SUPER_ADMIN' ? {} : { companyId: new mongoose.Types.ObjectId(companyId) };
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(months));

    // Get monthly aggregated data
    const [monthlyTrends, categoryBreakdown, driverTrends] = await Promise.all([
      // Monthly spend by type
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: monthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              type: '$type'
            },
            total: { $sum: '$amountFinal' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Category breakdown over time
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: monthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              category: '$category'
            },
            total: { $sum: '$amountFinal' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Top drivers trend
      Expense.aggregate([
        { $match: { ...baseQuery, date: { $gte: monthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              driverId: '$driverId'
            },
            total: { $sum: '$amountFinal' },
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.driverId',
            foreignField: '_id',
            as: 'driver'
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, total: -1 } }
      ])
    ]);

    // Format data for charts
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData: any = {
      labels: [],
      datasets: {
        fuel: [],
        misc: [],
        total: []
      },
      categoryData: {},
      driverData: {}
    };

    // Build labels and aggregate data
    const dataMap = new Map();
    monthlyTrends.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      const label = `${monthNames[item._id.month - 1]} ${item._id.year}`;

      if (!dataMap.has(key)) {
        dataMap.set(key, { label, fuel: 0, misc: 0, total: 0 });
      }

      const data = dataMap.get(key);
      if (item._id.type === 'FUEL') {
        data.fuel = item.total;
      } else if (item._id.type === 'MISC') {
        data.misc = item.total;
      }
      data.total += item.total;
    });

    // Sort by date and extract arrays
    const sortedData = Array.from(dataMap.values()).sort((a, b) => {
      const [aMonth, aYear] = a.label.split(' ');
      const [bMonth, bYear] = b.label.split(' ');
      return new Date(`${aMonth} 1, ${aYear}`).getTime() - new Date(`${bMonth} 1, ${bYear}`).getTime();
    });

    formattedData.labels = sortedData.map(d => d.label);
    formattedData.datasets.fuel = sortedData.map(d => d.fuel);
    formattedData.datasets.misc = sortedData.map(d => d.misc);
    formattedData.datasets.total = sortedData.map(d => d.total);

    res.json({
      success: true,
      data: formattedData,
      message: 'Trend data retrieved successfully'
    });
  })
);

// GET /api/reports/comparison - Compare periods
router.get('/comparison',
  authenticate,
  checkRole(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER']),
  asyncHandler(async (req: any, res) => {
    const { companyId, role } = req.user;
    const { period1Start, period1End, period2Start, period2End } = req.query;

    const baseQuery = role === 'SUPER_ADMIN' ? {} : { companyId: new mongoose.Types.ObjectId(companyId) };

    const [period1Data, period2Data] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            ...baseQuery,
            date: {
              $gte: new Date(period1Start),
              $lte: new Date(period1End)
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountFinal' },
            fuel: {
              $sum: {
                $cond: [{ $eq: ['$type', 'FUEL'] }, '$amountFinal', 0]
              }
            },
            misc: {
              $sum: {
                $cond: [{ $eq: ['$type', 'MISC'] }, '$amountFinal', 0]
              }
            },
            count: { $sum: 1 },
            avgExpense: { $avg: '$amountFinal' },
            drivers: { $addToSet: '$driverId' }
          }
        }
      ]),
      Expense.aggregate([
        {
          $match: {
            ...baseQuery,
            date: {
              $gte: new Date(period2Start),
              $lte: new Date(period2End)
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountFinal' },
            fuel: {
              $sum: {
                $cond: [{ $eq: ['$type', 'FUEL'] }, '$amountFinal', 0]
              }
            },
            misc: {
              $sum: {
                $cond: [{ $eq: ['$type', 'MISC'] }, '$amountFinal', 0]
              }
            },
            count: { $sum: 1 },
            avgExpense: { $avg: '$amountFinal' },
            drivers: { $addToSet: '$driverId' }
          }
        }
      ])
    ]);

    const p1 = period1Data[0] || { total: 0, fuel: 0, misc: 0, count: 0, avgExpense: 0, drivers: [] };
    const p2 = period2Data[0] || { total: 0, fuel: 0, misc: 0, count: 0, avgExpense: 0, drivers: [] };

    const comparison = {
      period1: {
        ...p1,
        driverCount: p1.drivers.length,
        period: { start: period1Start, end: period1End }
      },
      period2: {
        ...p2,
        driverCount: p2.drivers.length,
        period: { start: period2Start, end: period2End }
      },
      changes: {
        totalChange: p1.total > 0 ? ((p2.total - p1.total) / p1.total) * 100 : 0,
        fuelChange: p1.fuel > 0 ? ((p2.fuel - p1.fuel) / p1.fuel) * 100 : 0,
        miscChange: p1.misc > 0 ? ((p2.misc - p1.misc) / p1.misc) * 100 : 0,
        countChange: p1.count > 0 ? ((p2.count - p1.count) / p1.count) * 100 : 0,
        avgExpenseChange: p1.avgExpense > 0 ? ((p2.avgExpense - p1.avgExpense) / p1.avgExpense) * 100 : 0,
        driverCountChange: p1.drivers.length - p2.drivers.length
      }
    };

    res.json({
      success: true,
      data: comparison,
      message: 'Comparison data retrieved successfully'
    });
  })
);

export { router as reportRoutes };
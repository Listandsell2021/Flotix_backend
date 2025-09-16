import mongoose from 'mongoose';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Vehicle } from '../models/Vehicle';
import { Expense } from '../models/Expense';
import { config } from '@fleetflow/config';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow');
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      Vehicle.deleteMany({}),
      Expense.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create demo company
    const company = await Company.create({
      name: 'Demo Fleet Company',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      driverLimit: 100
    });
    console.log('Created company:', company.name);

    // Create super admin user
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'admin@fleetflow.com',
      passwordHash: 'password123', // Will be hashed by pre-save middleware
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    });
    console.log('Created super admin:', superAdmin.email);

    // Create company admin
    const admin = await User.create({
      name: 'Company Admin',
      email: 'admin@democompany.com',
      passwordHash: 'password123', // Will be hashed by pre-save middleware
      role: 'ADMIN',
      companyId: company._id,
      status: 'ACTIVE'
    });
    console.log('Created admin:', admin.email);

    // Create drivers (using create() to trigger password hashing middleware)
    const johnDriver = await User.create({
      name: 'John Driver',
      email: 'john@democompany.com',
      passwordHash: 'password123', // Will be hashed by pre-save middleware
      role: 'DRIVER',
      companyId: company._id,
      status: 'ACTIVE'
    });

    const sarahDriver = await User.create({
      name: 'Sarah Wilson',
      email: 'sarah@democompany.com',
      passwordHash: 'password123', // Will be hashed by pre-save middleware
      role: 'DRIVER',
      companyId: company._id,
      status: 'ACTIVE'
    });

    const mikeDriver = await User.create({
      name: 'Mike Johnson',
      email: 'mike@democompany.com',
      passwordHash: 'password123', // Will be hashed by pre-save middleware
      role: 'DRIVER',
      companyId: company._id,
      status: 'ACTIVE'
    });

    const drivers = [johnDriver, sarahDriver, mikeDriver];
    console.log('Created drivers:', drivers.length);

    // Create fleet vehicles
    const vehicle1 = await Vehicle.create({
      companyId: company._id,
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      licensePlate: 'ABC-123',
      vin: '1HGBH41JXMN109186',
      type: 'CAR',
      status: 'ACTIVE',
      currentOdometer: 25420,
      assignedDriverId: drivers[0]._id, // John Driver
      fuelType: 'Gasoline',
      color: 'White',
      purchaseDate: new Date('2022-03-15'),
    });

    const vehicle2 = await Vehicle.create({
      companyId: company._id,
      make: 'Ford',
      model: 'Transit',
      year: 2023,
      licensePlate: 'DEF-456',
      vin: '2FMHK6C83MBA12345',
      type: 'VAN',
      status: 'ACTIVE',
      currentOdometer: 18750,
      assignedDriverId: drivers[1]._id, // Sarah Wilson
      fuelType: 'Diesel',
      color: 'Blue',
      purchaseDate: new Date('2023-01-20'),
    });

    const vehicle3 = await Vehicle.create({
      companyId: company._id,
      make: 'Chevrolet',
      model: 'Silverado',
      year: 2021,
      licensePlate: 'GHI-789',
      vin: '1GCRYDED5MZ123456',
      type: 'TRUCK',
      status: 'ACTIVE',
      currentOdometer: 42300,
      assignedDriverId: drivers[2]._id, // Mike Johnson
      fuelType: 'Gasoline',
      color: 'Silver',
      purchaseDate: new Date('2021-08-10'),
    });

    const vehicle4 = await Vehicle.create({
      companyId: company._id,
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      licensePlate: 'JKL-101',
      type: 'CAR',
      status: 'MAINTENANCE',
      currentOdometer: 68900,
      fuelType: 'Gasoline',
      color: 'Red',
      purchaseDate: new Date('2020-05-12'),
    });

    const vehicle5 = await Vehicle.create({
      companyId: company._id,
      make: 'Nissan',
      model: 'NV200',
      year: 2019,
      licensePlate: 'MNO-202',
      type: 'VAN',
      status: 'RETIRED',
      currentOdometer: 125600,
      fuelType: 'Gasoline',
      color: 'Gray',
      purchaseDate: new Date('2019-02-28'),
    });

    const vehicles = [vehicle1, vehicle2, vehicle3, vehicle4, vehicle5];
    console.log('Created vehicles:', vehicles.length);

    // Create sample expenses for current month and previous month
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15); // Mid last month
    
    const expenses = await Expense.insertMany([
      // Current month expenses
      {
        driverId: drivers[0]._id,
        companyId: company._id,
        vehicleId: vehicles[0]._id,
        type: 'FUEL',
        amountFinal: 85.50,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt1.jpg',
        merchant: 'Shell Gas Station',
        kilometers: 450,
        odometerReading: 25870, // Updated odometer after trip
        date: new Date(),
      },
      {
        driverId: drivers[1]._id,
        companyId: company._id,
        vehicleId: vehicles[1]._id,
        type: 'MISC',
        category: 'PARKING',
        amountFinal: 25.00,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt2.jpg',
        merchant: 'Downtown Parking',
        kilometers: 85,
        odometerReading: 18835,
        date: new Date(Date.now() - 86400000), // Yesterday
      },
      {
        driverId: drivers[0]._id,
        companyId: company._id,
        vehicleId: vehicles[0]._id,
        type: 'FUEL',
        amountFinal: 92.75,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt3.jpg',
        merchant: 'Chevron',
        kilometers: 320,
        odometerReading: 25420, // Current odometer
        date: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        driverId: drivers[2]._id,
        companyId: company._id,
        vehicleId: vehicles[2]._id,
        type: 'MISC',
        category: 'TOLL',
        amountFinal: 12.50,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt4.jpg',
        merchant: 'Highway Toll',
        kilometers: 180,
        odometerReading: 42480,
        date: new Date(Date.now() - 259200000), // 3 days ago
      },
      {
        driverId: drivers[1]._id,
        companyId: company._id,
        vehicleId: vehicles[1]._id,
        type: 'FUEL',
        amountFinal: 78.25,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt5.jpg',
        merchant: 'BP Gas Station',
        kilometers: 275,
        odometerReading: 18750, // Current odometer
        date: new Date(Date.now() - 432000000), // 5 days ago
      },
      {
        driverId: drivers[2]._id,
        companyId: company._id,
        vehicleId: vehicles[2]._id,
        type: 'MISC',
        category: 'REPAIR',
        amountFinal: 150.00,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt6.jpg',
        merchant: 'Auto Repair Shop',
        kilometers: 65,
        odometerReading: 42300, // Current odometer
        date: new Date(Date.now() - 604800000), // 1 week ago
      },
      // Previous month expenses for comparison
      {
        driverId: drivers[0]._id,
        companyId: company._id,
        vehicleId: vehicles[0]._id,
        type: 'FUEL',
        amountFinal: 89.50,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt7.jpg',
        merchant: 'Shell Gas Station',
        kilometers: 380,
        odometerReading: 25100, // Previous odometer reading
        date: lastMonth,
      },
      {
        driverId: drivers[1]._id,
        companyId: company._id,
        vehicleId: vehicles[1]._id,
        type: 'FUEL',
        amountFinal: 95.75,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt8.jpg',
        merchant: 'Exxon',
        kilometers: 425,
        odometerReading: 18325, // Previous odometer reading
        date: new Date(lastMonth.getTime() + 86400000), // Last month + 1 day
      },
      {
        driverId: drivers[2]._id,
        companyId: company._id,
        vehicleId: vehicles[2]._id,
        type: 'MISC',
        category: 'PARKING',
        amountFinal: 30.00,
        currency: 'EUR',
        receiptUrl: 'https://example.com/receipt9.jpg',
        merchant: 'Airport Parking',
        kilometers: 95,
        odometerReading: 42205, // Previous odometer reading
        date: new Date(lastMonth.getTime() + 172800000), // Last month + 2 days
      }
    ]);
    console.log('Created expenses:', expenses.length);

    console.log('\n=== SEED DATA SUMMARY ===');
    console.log('Company:', company.name);
    console.log('Super Admin:', superAdmin.email, '(password: password123)');
    console.log('Admin:', admin.email, '(password: password123)');
    console.log('Drivers:', drivers.map(d => `${d.name} (${d.email})`).join(', '));
    console.log('Vehicles:', vehicles.map(v => `${v.make} ${v.model} (${v.licensePlate})`).join(', '));
    console.log('Expenses:', expenses.length, 'sample expenses with vehicle data');
    console.log('========================\n');

    await mongoose.disconnect();
    console.log('Database seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
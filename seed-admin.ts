import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from './src/models/Admin';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nueronixlearn';

async function seedSuperAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const existingAdmin = await Admin.findOne({ username: 'Admin' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      
      // Update password to Admin@0410, set as super admin with full permissions
      const hashedPassword = await bcrypt.hash('Admin@0410', 12);
      existingAdmin.password = hashedPassword;
      existingAdmin.isSuperAdmin = true;
      existingAdmin.permissions = {
        manageUsers: true,
        manageCourses: true,
        manageExams: true,
        manageAdmins: true,
        viewAnalytics: true,
        manageContent: true
      };
      await existingAdmin.save();
      console.log('Updated admin to Super Admin with password Admin@0410');
    } else {
      const hashedPassword = await bcrypt.hash('Admin@0410', 12);
      const superAdmin = new Admin({
        username: 'Admin',
        password: hashedPassword,
        email: 'admin@nueronixlearn.com',
        isSuperAdmin: true,
        permissions: {
          manageUsers: true,
          manageCourses: true,
          manageExams: true,
          manageAdmins: true,
          viewAnalytics: true,
          manageContent: true
        }
      });
      await superAdmin.save();
      console.log('Created default super admin: Admin / Admin@0410');
    }

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedSuperAdmin();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from './src/models/Admin';

const MONGODB_URI = 'mongodb+srv://akashchoppadandi04_db_user:C7f7YyzqKhWuQEoC@nuerolearn.zk674ag.mongodb.net/neurlearn?retryWrites=true&w=majority';

async function checkAndFix() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');

    const admin = await Admin.findOne({ username: 'Admin' });
    if (!admin) {
      console.log('Creating new admin...');
      const hashedPassword = await bcrypt.hash('Admin@0410', 12);
      const newAdmin = new Admin({
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
      await newAdmin.save();
      console.log('Admin created: Admin / Admin@0410');
    } else {
      console.log('Admin exists:', admin.username, admin.email);
      console.log('isSuperAdmin:', admin.isSuperAdmin);
      const match = await bcrypt.compare('Admin@0410', admin.password);
      console.log('Password match:', match);
      
      if (!match || admin.email !== 'admin@nueronixlearn.com') {
        console.log('Setting new password (will be hashed by pre-save hook)...');
        admin.password = 'Admin@0410';
        admin.email = 'admin@nueronixlearn.com';
        admin.isSuperAdmin = true;
        admin.permissions = {
          manageUsers: true,
          manageCourses: true,
          manageExams: true,
          manageAdmins: true,
          viewAnalytics: true,
          manageContent: true
        };
        await admin.save();
        console.log('Updated');
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkAndFix();

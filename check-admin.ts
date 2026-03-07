import mongoose from 'mongoose';
import Admin from './src/models/Admin';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nueronixlearn';

async function checkAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    const admin = await Admin.findOne({ username: 'Admin' });
    if (admin) {
      console.log('Admin found:', {
        username: admin.username,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions
      });
    } else {
      console.log('Admin not found');
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkAdmin();

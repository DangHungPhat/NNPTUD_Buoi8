/**
 * Script import User từ file user.xlsx
 * Chạy: node importUsers.js
 *
 * Yêu cầu: file user.xlsx phải có header row gồm cột "username" và "email"
 */

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const path = require('path');

// ─── CẤU HÌNH MAILTRAP ────────────────────────────────────────────────────────
const MAILTRAP_USER = '819030068b826b';
const MAILTRAP_PASS = '715c20e408b22a';

// ─── CẤU HÌNH FILE & DB ───────────────────────────────────────────────────────
const EXCEL_FILE = path.join(__dirname, 'user.xlsx');
const MONGO_URI  = 'mongodb://localhost:27017/NNPTUD-C6';

// ─── NODEMAILER TRANSPORTER ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
        user: MAILTRAP_USER,
        pass: MAILTRAP_PASS,
    },
});

// ─── MONGOOSE SCHEMAS (inline, không cần require app) ─────────────────────────
const bcrypt = require('bcrypt');

const roleSchema = new mongoose.Schema({
    name:        { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    isDeleted:   { type: Boolean, default: false },
}, { timestamps: true });
const Role = mongoose.model('role', roleSchema);

const userSchema = new mongoose.Schema({
    username:  { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    email:     { type: String, required: true, unique: true, lowercase: true },
    fullName:  { type: String, default: '' },
    avatarUrl: { type: String, default: 'https://i.sstatic.net/l60Hf.png' },
    status:    { type: Boolean, default: true },
    role:      { type: mongoose.Schema.Types.ObjectId, ref: 'role', required: true },
    loginCount:{ type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Hash password trước khi lưu
userSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const salt = bcrypt.genSaltSync(10);
        this.password = bcrypt.hashSync(this.password, salt);
    }
});
const User = mongoose.model('user', userSchema);

// ─── HELPER: tạo password random 16 ký tự ────────────────────────────────────
function generatePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

// ─── HELPER: gửi email thông báo ─────────────────────────────────────────────
async function sendPasswordMail(to, username, password) {
    await transporter.sendMail({
        from: 'admin@hehehe.com',
        to: to,
        subject: 'Thông tin tài khoản của bạn',
        text: `Xin chào ${username},\nTài khoản của bạn đã được tạo.\nUsername: ${username}\nPassword: ${password}\nVui lòng đổi mật khẩu sau khi đăng nhập lần đầu.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 24px;">
                <h2 style="color: #4A90E2;">Chào mừng, <b>${username}</b>!</h2>
                <p>Tài khoản của bạn đã được tạo thành công.</p>
                <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                    <tr>
                        <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Username</td>
                        <td style="padding: 8px;">${username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Password</td>
                        <td style="padding: 8px; font-family: monospace; font-size: 16px;">${password}</td>
                    </tr>
                </table>
                <p style="color: #e74c3c; font-weight: bold;">⚠ Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>
            </div>
        `,
    });
}

// ─── HELPER: lấy giá trị cell (xử lý cả formula cell) ───────────────────────
function getCellValue(cell) {
    const v = cell.value;
    if (v === null || v === undefined) return null;
    // ExcelJS trả về object { formula, result } khi cell chứa công thức
    if (typeof v === 'object' && v.result !== undefined) return v.result;
    return v;
}

// ─── HÀM CHÍNH ────────────────────────────────────────────────────────────────
async function importUsers() {
    // 1. Kết nối MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    // 2. Tìm role "user", tự tạo nếu chưa có
    let userRole = await Role.findOne({ name: 'user', isDeleted: false });
    if (!userRole) {
        userRole = await Role.create({ name: 'user', description: 'User thông thường', isDeleted: false });
        console.log(`🆕 Đã tạo role "user" mới: ${userRole._id}`);
    } else {
        console.log(`✅ Tìm thấy role "user": ${userRole._id}`);
    }
    console.log();

    // 3. Đọc file Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.worksheets[0];
    console.log(`📄 Đọc file: ${EXCEL_FILE}`);
    console.log(`   Sheet: "${worksheet.name}", ${worksheet.rowCount} dòng\n`);

    // 4. Xác định cột username, email từ header
    const headerRow = worksheet.getRow(1);
    let usernameCol = -1, emailCol = -1;
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().trim().toLowerCase() : '';
        if (val === 'username') usernameCol = colNumber;
        if (val === 'email')    emailCol    = colNumber;
    });

    if (usernameCol === -1 || emailCol === -1) {
        console.error('❌ File Excel không có cột "username" hoặc "email"!');
        process.exit(1);
    }

    // 5. Duyệt từng dòng dữ liệu
    const results = { success: [], failed: [] };

    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const username = getCellValue(row.getCell(usernameCol));
        const email    = getCellValue(row.getCell(emailCol));

        if (!username || !email) continue; // bỏ qua dòng trống

        const rawPassword = generatePassword(16);

        try {
            // Tạo user trong DB
            const newUser = new User({
                username: username.toString().trim(),
                password: rawPassword,
                email:    email.toString().trim().toLowerCase(),
                role:     userRole._id,
                status:   true,
            });
            await newUser.save();

            // Gửi email (thất bại không ảnh hưởng user đã tạo)
            let emailStatus = '📧 email đã gửi';
            try {
                await sendPasswordMail(
                    email.toString().trim(),
                    username.toString().trim(),
                    rawPassword
                );
            } catch (mailErr) {
                emailStatus = `⚠ email lỗi: ${mailErr.message.slice(0, 60)}`;
            }

            console.log(`  ✅ [${i-1}] ${username} <${email}> — tạo thành công | ${emailStatus}`);
            results.success.push({ username, email });

        } catch (err) {
            console.log(`  ❌ [${i-1}] ${username} <${email}> — thất bại: ${err.message}`);
            results.failed.push({ username, email, reason: err.message });
        }
    }

    // 6. Tổng kết
    console.log('\n──────────────────────────────────────────');
    console.log(`📊 Kết quả import:`);
    console.log(`   ✅ Thành công : ${results.success.length} user`);
    console.log(`   ❌ Thất bại   : ${results.failed.length} user`);
    if (results.failed.length > 0) {
        console.log('\n   Chi tiết thất bại:');
        results.failed.forEach(f => console.log(`   - ${f.username}: ${f.reason}`));
    }
    console.log('──────────────────────────────────────────\n');

    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB');
}

importUsers().catch(err => {
    console.error('❌ Lỗi nghiêm trọng:', err.message);
    mongoose.disconnect();
    process.exit(1);
});

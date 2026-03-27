let userModel = require('../schemas/users');
let roleModel = require('../schemas/roles');
let ExcelJS = require('exceljs');
let { sendPasswordMail } = require('../utils/senMailHandler');

module.exports = {
    CreateAnUser: function (username, password,
        email, role, fullname, avatar, status, logincount) {
        return new userModel(
            {
                username: username,
                password: password,
                email: email,
                fullName: fullname,
                avatarUrl: avatar,
                status: status,
                role: role,
                loginCount: logincount
            }
        )
    },
    FindByUsername: async function (username) {
        return await userModel.findOne({
            username: username,
            isDeleted: false
        })
    }, 
    FindByEmail: async function (email) {
        return await userModel.findOne({
            email: email,
            isDeleted: false
        })
    },
    FindByToken: async function (token) {
        return await userModel.findOne({
            resetPasswordToken: token,
            isDeleted: false
        })
    },
    FailLogin: async function (user) {
        user.loginCount++;
        if (user.loginCount == 3) {
            user.loginCount = 0;
            user.lockTime = new Date(Date.now() + 60 * 60 * 1000)
        }
        await user.save()
    },
    SuccessLogin: async function (user) {
        user.loginCount = 0;
        await user.save()
    },
    GetAllUser: async function () {
        return await userModel
            .find({ isDeleted: false }).populate({
                path: 'role',
                select: 'name'
            })
    },
    FindById: async function (id) {
        try {
            let getUser = await userModel
                .findOne({ isDeleted: false, _id: id }).populate({
                    path: 'role',
                    select: 'name'
                })
            return getUser;
        } catch (error) {
            return false
        }
    },
    ImportUsers: async function (filePath) {
        // Tìm role "user" trong DB
        let userRole = await roleModel.findOne({ name: 'user', isDeleted: false });
        if (!userRole) throw new Error('Role "user" không tồn tại trong hệ thống');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        // Tìm chỉ số cột username, email từ header row
        const headerRow = worksheet.getRow(1);
        let usernameCol = -1, emailCol = -1;
        headerRow.eachCell((cell, colNumber) => {
            const val = cell.value ? cell.value.toString().trim().toLowerCase() : '';
            if (val === 'username') usernameCol = colNumber;
            if (val === 'email') emailCol = colNumber;
        });
        if (usernameCol === -1 || emailCol === -1) {
            throw new Error('File Excel phải có cột "username" và "email"');
        }

        const results = [];
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const username = row.getCell(usernameCol).value;
            const email = row.getCell(emailCol).value;

            if (!username || !email) continue;

            // Tạo password random 16 ký tự
            let rawPassword = '';
            for (let k = 0; k < 16; k++) {
                rawPassword += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            try {
                const newUser = new userModel({
                    username: username.toString().trim(),
                    password: rawPassword,
                    email: email.toString().trim().toLowerCase(),
                    role: userRole._id,
                    status: true
                });
                await newUser.save();

                // Gửi email thông báo password
                await sendPasswordMail(email.toString().trim(), username.toString().trim(), rawPassword);

                results.push({ username, email, status: 'success' });
            } catch (err) {
                results.push({ username, email, status: 'failed', reason: err.message });
            }
        }
        return results;
    }
}
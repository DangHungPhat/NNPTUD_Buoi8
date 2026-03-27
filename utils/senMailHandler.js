const nodemailer = require("nodemailer");

// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false,
    auth: {
        user: "819030068b826b",
        pass: "715c20e408b22a",
    },
});
//http://localhost:3000/api/v1/auth/resetpassword/a87edf6812f235e997c7b751422e6b2f5cd95aa994c55ebeeb931ca67214d645

// Send an email using async/await;
module.exports = {
    sendMail: async function (to, url) {
        const info = await transporter.sendMail({
            from: 'admin@hehehe.com',
            to: to,
            subject: "reset pass",
            text: "click vo day de doi pass",
            html: "click vo <a href=" + url + ">day</a> de doi pass",
        });
    },
    sendPasswordMail: async function (to, username, password) {
        await transporter.sendMail({
            from: 'admin@hehehe.com',
            to: to,
            subject: "Thông tin tài khoản của bạn",
            text: `Xin chào ${username},\nTài khoản của bạn đã được tạo.\nUsername: ${username}\nPassword: ${password}\nVui lòng đổi mật khẩu sau khi đăng nhập.`,
            html: `<h3>Xin chào <b>${username}</b>,</h3>
                   <p>Tài khoản của bạn đã được tạo thành công.</p>
                   <p><b>Username:</b> ${username}</p>
                   <p><b>Password:</b> ${password}</p>
                   <p style="color:red">Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>`,
        });
    }
}
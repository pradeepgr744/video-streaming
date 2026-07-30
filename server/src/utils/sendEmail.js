import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail", // Or configure your SMTP provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // App Password for Gmail
  },
  family:4,
});

const sendEmail = async ({ to, subject, html, text }) => {
  await transporter.sendMail({
    from: `""<${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

export default sendEmail;

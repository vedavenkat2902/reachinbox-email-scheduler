import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(data: {
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
}) {
  const info = await transporter.sendMail({
    from: data.senderEmail,
    to: data.recipient,
    subject: data.subject,
    text: data.body,
  });

  return info;
}

export async function verifyEmailConnection() {
  await transporter.verify();
  console.log("SMTP connection verified");
}
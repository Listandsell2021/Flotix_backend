import mongoose, { Schema, Document } from 'mongoose';

export interface ISmtpSettings extends Document {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  testEmailSent?: boolean;
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SmtpSettingsSchema = new Schema<ISmtpSettings>(
  {
    host: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },
    secure: {
      type: Boolean,
      default: false,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fromEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    fromName: {
      type: String,
      required: true,
      trim: true,
      default: 'Flotix Fleet Management',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    testEmailSent: {
      type: Boolean,
      default: false,
    },
    lastTestedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Only one SMTP settings document should exist (singleton pattern)
SmtpSettingsSchema.index({ isActive: 1 });

// Don't expose password in JSON responses
SmtpSettingsSchema.methods.toJSON = function () {
  const obj = this.toObject();
  // Mask password (show only first 2 and last 2 characters)
  if (obj.password && obj.password.length > 4) {
    obj.password = obj.password.slice(0, 2) + '****' + obj.password.slice(-2);
  }
  return obj;
};

export type SmtpSettingsDocument = ISmtpSettings;
export const SmtpSettings = mongoose.model<ISmtpSettings>('SmtpSettings', SmtpSettingsSchema);

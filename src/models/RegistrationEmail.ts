import mongoose, { Document, Schema } from 'mongoose';

export interface IRegistrationEmail extends Document {
  email: string;
  company?: string;
  message?: string;
  status: 'pending' | 'contacted' | 'converted';
  createdAt: Date;
  updatedAt: Date;
}

const registrationEmailSchema = new Schema<IRegistrationEmail>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  company: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'converted'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for faster queries
registrationEmailSchema.index({ createdAt: -1 });
registrationEmailSchema.index({ status: 1 });

export const RegistrationEmail = mongoose.model<IRegistrationEmail>('RegistrationEmail', registrationEmailSchema);
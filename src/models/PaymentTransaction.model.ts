import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IPaymentTransaction extends Document {
  student: Types.ObjectId
  course: Types.ObjectId
  provider: "paystack"
  reference: string
  amount: number
  currency: string
  status: "pending" | "success" | "failed"
  authorizationUrl?: string
  paidAt?: Date
  providerResponse?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    provider: { type: String, enum: ["paystack"], default: "paystack", required: true },
    reference: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN", required: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending", required: true },
    authorizationUrl: { type: String },
    paidAt: { type: Date },
    providerResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

PaymentTransactionSchema.index({ student: 1, course: 1, status: 1 })

const PaymentTransaction: Model<IPaymentTransaction> =
  mongoose.models.PaymentTransaction ??
  mongoose.model<IPaymentTransaction>("PaymentTransaction", PaymentTransactionSchema)

export default PaymentTransaction

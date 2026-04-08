import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ICertificate extends Document {
  student: Types.ObjectId
  course: Types.ObjectId
  pdfUrl?: string
  cloudinaryPublicId?: string
  issuedAt: Date
}

const CertificateSchema = new Schema<ICertificate>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    pdfUrl: { type: String },
    cloudinaryPublicId: { type: String },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

CertificateSchema.index({ student: 1, course: 1 }, { unique: true })

const Certificate: Model<ICertificate> =
  mongoose.models.Certificate ?? mongoose.model<ICertificate>("Certificate", CertificateSchema)

export default Certificate

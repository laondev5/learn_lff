import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ICertificate extends Document {
  student: Types.ObjectId
  course: Types.ObjectId
  /** Human-verifiable certificate number printed on the certificate. */
  serial?: string
  pdfUrl?: string
  cloudinaryPublicId?: string
  issuedAt: Date
}

const CertificateSchema = new Schema<ICertificate>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    serial: { type: String, trim: true, maxlength: 40 },
    pdfUrl: { type: String },
    cloudinaryPublicId: { type: String },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

CertificateSchema.index({ student: 1, course: 1 }, { unique: true })
// Sparse so legacy certificates issued before serials existed stay valid.
CertificateSchema.index({ serial: 1 }, { unique: true, sparse: true })

const Certificate: Model<ICertificate> =
  mongoose.models.Certificate ?? mongoose.model<ICertificate>("Certificate", CertificateSchema)

export default Certificate

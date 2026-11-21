import "server-only"
import mongoose, { Schema, Model, Types } from "mongoose"

export interface ICertificateTemplate {
  _id: Types.ObjectId
  course: Types.ObjectId
  title: string
  institutionName: string
  logos: { url: string; alt?: string }[]
  signatures: { name: string; role: string; url?: string }[]
  isEnabled: boolean
  updatedAt: Date
}

const schema = new Schema<ICertificateTemplate>({
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true, unique: true },
  title: { type: String, trim: true, maxlength: 120, default: "Certificate of Completion" },
  institutionName: { type: String, trim: true, maxlength: 160, default: "" },
  logos: [{
    url: { type: String, required: true },
    alt: { type: String, trim: true, maxlength: 120 },
  }],
  signatures: [{
    name: { type: String, trim: true, maxlength: 120 },
    role: { type: String, trim: true, maxlength: 120 },
    url: { type: String },
  }],
  isEnabled: { type: Boolean, default: true },
}, { timestamps: true })

const CertificateTemplate: Model<ICertificateTemplate> =
  mongoose.models.CertificateTemplate ?? mongoose.model<ICertificateTemplate>("CertificateTemplate", schema)

export default CertificateTemplate

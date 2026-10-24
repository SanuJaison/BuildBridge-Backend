const schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.resetPasswordHash;
      delete ret.resetPasswordExpires;
      return ret;
    },
  },
};

module.exports = { schemaOptions };

'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const Admin = mongoose.model(
  'Admin',
  new Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      username: { type: String, lowercase: true, trim: true, index: true },
      name: { type: String, default: 'Administrator' },
      passwordHash: { type: String, required: true },
      tokenVersion: { type: Number, default: 0 },
    },
    { timestamps: true }
  )
);

// One document holding every editable section of the website.
const Setting = mongoose.model(
  'Setting',
  new Schema({ key: { type: String, unique: true }, data: Schema.Types.Mixed }, { timestamps: true, minimize: false })
);

const Announcement = mongoose.model(
  'Announcement',
  new Schema(
    {
      title: { type: String, required: true, trim: true, maxlength: 200 },
      description: { type: String, default: '', maxlength: 4000 },
      date: { type: Date, default: Date.now },
      image: { type: String, default: '' },
      important: { type: Boolean, default: false },
      published: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);

const GalleryImage = mongoose.model(
  'GalleryImage',
  new Schema(
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      title: { type: String, default: '', maxlength: 200 },
      category: { type: String, default: 'School', maxlength: 80 },
      published: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);

const Media = mongoose.model(
  'Media',
  new Schema(
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      label: { type: String, default: '', maxlength: 120 },
      width: Number,
      height: Number,
    },
    { timestamps: true }
  )
);

const Application = mongoose.model(
  'Application',
  new Schema(
    {
      ref: { type: String, index: true },
      applicant: { type: String, default: '' },
      classApplied: { type: String, default: '' },
      answers: [{ _id: false, key: String, label: String, value: String }],
      searchText: { type: String, default: '', index: true },
      read: { type: Boolean, default: false },
      emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'not_configured'], default: 'pending' },
    },
    { timestamps: true }
  )
);

const PushSub = mongoose.model(
  'PushSub',
  new Schema(
    {
      endpoint: { type: String, required: true, unique: true },
      keys: { p256dh: String, auth: String },
      admin: { type: Schema.Types.ObjectId, ref: 'Admin' },
      userAgent: { type: String, default: '' },
    },
    { timestamps: true }
  )
);

module.exports = { Admin, Setting, Announcement, GalleryImage, Media, Application, PushSub };

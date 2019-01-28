import mongoose from 'mongoose';
import mongooseApiQuery from '../../src/utils/mongooseApiQuery';
import mongooseIntl from 'mongoose-intl';
import payloadConfig from '.././payload.config';

const PageSchema = new mongoose.Schema({
    title: {type: String, intl: true},
    content: {type: String, intl: true},
    slug: {type: String, unique: true, required: true},
    metaTitle: String,
    metaDesc: String
  }
);

PageSchema.plugin(mongooseApiQuery);

PageSchema.plugin(mongooseIntl, payloadConfig.localization);

module.exports = mongoose.model('Page', PageSchema);

import httpStatus from 'http-status';

const findOne = (req, res) => {
  req.model.findOne({ _id: req.params._id }, (err, doc) => {
    if (err)
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: err });

    if (!doc)
      return res.status(httpStatus.NOT_FOUND).send('Not Found');

    if (req.locale) {
      doc.setLocale(req.locale, req.query['fallback-code']);
      return res.json(doc.toJSON({ virtuals: true }));
    }

    return res.json(doc);
  });
};

export default findOne;

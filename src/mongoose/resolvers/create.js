import { APIError } from '../../errors';

const create = (query) => {
  return new Promise((resolve, reject) => {
    query.Model.create(query.input, (err, doc) => {
      console.log(err, doc);
      if (err || !doc) {
        reject(new APIError(err));
        return;
      }
      resolve(doc);
    });
  });
};

export default create;

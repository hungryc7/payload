import getConfig from '../../config/load';
import { email, password } from '../../mongoose/testCredentials';

require('isomorphic-fetch');

const { serverURL: url } = getConfig();

let token = null;
let headers = null;

describe('Revisions - REST', () => {
  beforeAll(async (done) => {
    const response = await fetch(`${url}/api/admins/login`, {
      body: JSON.stringify({
        email,
        password,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'post',
    });

    const data = await response.json();

    ({ token } = data);

    headers = {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
    };

    done();
  });

  describe('Create', () => {
    it('should allow a new revision to be created', async () => {
      const title1 = 'Here is a localized post in EN';

      const post = await fetch(`${url}/api/localized-posts`, {
        body: JSON.stringify({
          title: title1,
          description: '345j23o4ifj34jf54g',
          priority: 10,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      expect(typeof post.doc.id).toBe('string');

      const title2 = 'Here is an updated post title in EN';

      const updatedPost = await fetch(`${url}/api/localized-posts/${post.doc.id}`, {
        body: JSON.stringify({
          title: title2,
        }),
        headers,
        method: 'put',
      }).then((res) => res.json());

      expect(updatedPost.doc.title).toBe(title2);
    });
  });
});

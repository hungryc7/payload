import getConfig from '../../config/load';
import { email, password } from '../../mongoose/testCredentials';

require('isomorphic-fetch');

const { serverURL: url } = getConfig();

let token = null;
let headers = null;
let versionID;

describe('Global Versions - REST', () => {
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

    await fetch(`${url}/api/globals/blocks-global`, {
      body: JSON.stringify({
        title: 'Test Global',
        blocks: [
          {
            blockType: 'quote',
            quote: 'This is a global that will be published',
            color: 'red',
          },
        ],
      }),
      headers,
      method: 'post',
    }).then((res) => res.json());

    done();
  });

  describe('Create', () => {
    it('should allow a new version to be created', async () => {
      const title2 = 'Here is an updated global title in EN';

      const updatedPost = await fetch(`${url}/api/globals/blocks-global`, {
        body: JSON.stringify({
          title: title2,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      expect(updatedPost.result.title).toBe(title2);
      expect(updatedPost.result._status).toStrictEqual('draft');

      const versions = await fetch(`${url}/api/globals/blocks-global/versions`, {
        headers,
      }).then((res) => res.json());

      versionID = versions.docs[0].id;
    });

    it('should allow a version to be retrieved by ID', async () => {
      const version = await fetch(`${url}/api/globals/blocks-global/versions/${versionID}`, {
        headers,
      }).then((res) => res.json());

      expect(version.id).toStrictEqual(versionID);
    });

    it('should allow a version to save locales properly', async () => {
      const englishTitle = 'Title in EN';
      const spanishTitle = 'Title in ES';

      await fetch(`${url}/api/globals/blocks-global`, {
        body: JSON.stringify({
          title: englishTitle,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      const updatedPostES = await fetch(`${url}/api/globals/blocks-global?locale=es`, {
        body: JSON.stringify({
          title: spanishTitle,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      expect(updatedPostES.result.title).toBe(spanishTitle);

      const newEnglishTitle = 'New title in EN';

      await fetch(`${url}/api/globals/blocks-global`, {
        body: JSON.stringify({
          title: newEnglishTitle,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      const versions = await fetch(`${url}/api/globals/blocks-global/versions?locale=all`, {
        headers,
      }).then((res) => res.json());

      expect(versions.docs[0].version.title.en).toStrictEqual(newEnglishTitle);
      expect(versions.docs[0].version.title.es).toStrictEqual(spanishTitle);
    });
  });

  describe('Restore', () => {
    it('should allow a version to be restored', async () => {
      const title2 = 'Here is an updated post title in EN';

      const updatedPost = await fetch(`${url}/api/globals/blocks-global`, {
        body: JSON.stringify({
          title: title2,
        }),
        headers,
        method: 'post',
      }).then((res) => res.json());

      expect(updatedPost.result.title).toBe(title2);

      const versions = await fetch(`${url}/api/globals/blocks-global/versions`, {
        headers,
      }).then((res) => res.json());

      versionID = versions.docs[0].id;

      const restore = await fetch(`${url}/api/globals/blocks-global/versions/${versionID}`, {
        headers,
        method: 'post',
      }).then((res) => res.json());

      expect(restore.message).toBeDefined();
      expect(restore.doc.title).toBeDefined();

      const restoredPost = await fetch(`${url}/api/globals/blocks-global?draft=true`, {
        headers,
      }).then((res) => res.json());

      expect(restoredPost.title).toBe(restore.doc.title);
    });
  });

  // describe('Draft Access Control', () => {
  //   it('should prevent a draft from being publicly readable', async () => {
  //     const badAttempt = await fetch(`${url}/api/autosave-posts/${postID}`);
  //     expect(badAttempt.status).toBe(404);
  //   });

  //   it('should prevent an authenticated user from retrieving drafts without asking', async () => {
  //     const badAttempt = await fetch(`${url}/api/autosave-posts/${postID}`, {
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     expect(badAttempt.status).toBe(404);
  //   });

  //   it('should allow an authenticated user to explicitly retrieve draft', async () => {
  //     const badAttempt = await fetch(`${url}/api/autosave-posts/${postID}?draft=true`, {
  //       headers,
  //     });

  //     expect(badAttempt.status).toBe(200);
  //   });
  // });
});

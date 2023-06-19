import httpStatus from 'http-status';
import { APIError } from '../../errors';
import { Collection } from '../../collections/config/types';
import { PayloadRequest } from '../../express/types';

export type Args = {
  req: PayloadRequest,
  token: string
  collection: Collection
}

async function verifyEmail(args: Args): Promise<boolean> {
  const {
    req,
    token,
    collection,
  } = args;
  if (!Object.prototype.hasOwnProperty.call(args, 'token')) {
    throw new APIError('Missing required data.', httpStatus.BAD_REQUEST);
  }

  const { docs } = await req.payload.db.find<any>({
    collection: collection.config.slug,
    limit: 1,
    where: {
      _verificationToken: { equals: token },
    },
  });

  const [user] = docs;

  if (!user) throw new APIError('Verification token is invalid.', httpStatus.BAD_REQUEST);
  if (user && user._verified === true) throw new APIError('This account has already been activated.', httpStatus.ACCEPTED);

  await req.payload.db.update({
    collection: collection.config.slug,
    where: {
      id: user.id,
    },
    data: {
      _verified: true,
      _verificationToken: undefined,
    },
  });

  return true;
}

export default verifyEmail;

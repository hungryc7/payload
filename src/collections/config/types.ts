/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeepRequired } from 'ts-essentials';
import { GraphQLInputObjectType, GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { Response } from 'express';
import { Config as GeneratedTypes } from 'payload/generated-types';
import { Access, Endpoint, EntityDescription, GeneratePreviewURL } from '../../config/types';
import { Field } from '../../fields/config/types';
import { PayloadRequest, RequestContext } from '../../express/types';
import { Auth, IncomingAuthType, User } from '../../auth/types';
import { IncomingUploadType, Upload } from '../../uploads/types';
import { IncomingCollectionVersions, SanitizedCollectionVersions } from '../../versions/types';
import {
  CustomPreviewButtonProps,
  CustomPublishButtonProps,
  CustomSaveButtonProps,
  CustomSaveDraftButtonProps,
} from '../../admin/components/elements/types';
import type { Props as ListProps } from '../../admin/components/views/collections/List/types';
import type { Props as EditProps } from '../../admin/components/views/collections/Edit/types';

export type HookOperationType =
  | 'create'
  | 'autosave'
  | 'read'
  | 'update'
  | 'delete'
  | 'refresh'
  | 'login'
  | 'forgotPassword';

type CreateOrUpdateOperation = Extract<HookOperationType, 'create' | 'update'>;

export type BeforeOperationHook = (args: {
  args?: any;
  /**
   * Hook operation being performed
   */
  operation: HookOperationType;
  context: RequestContext;
}) => any;

export type BeforeValidateHook<T extends TypeWithID = any> = (args: {
  data?: Partial<T>;
  req?: PayloadRequest;
  /**
   * Hook operation being performed
   */
  operation: CreateOrUpdateOperation;
  /**
   * Original document before change
   *
   * `undefined` on 'create' operation
   */
  originalDoc?: T;
  context: RequestContext;
}) => any;

export type BeforeChangeHook<T extends TypeWithID = any> = (args: {
  data: Partial<T>;
  req: PayloadRequest;
  /**
   * Hook operation being performed
   */
  operation: CreateOrUpdateOperation;
  /**
   * Original document before change
   *
   * `undefined` on 'create' operation
   */
  originalDoc?: T;
  context: RequestContext;
}) => any;

export type AfterChangeHook<T extends TypeWithID = any> = (args: {
  doc: T;
  req: PayloadRequest;
  previousDoc: T,
  /**
   * Hook operation being performed
   */
  operation: CreateOrUpdateOperation;
  context: RequestContext;
}) => any;

export type BeforeReadHook<T extends TypeWithID = any> = (args: {
  doc: T;
  req: PayloadRequest;
  query: { [key: string]: any };
  context: RequestContext;
}) => any;

export type AfterReadHook<T extends TypeWithID = any> = (args: {
  doc: T;
  req: PayloadRequest;
  query?: { [key: string]: any };
  findMany?: boolean;
  context: RequestContext;
}) => any;

export type BeforeDeleteHook = (args: {
  req: PayloadRequest;
  id: string | number;
  context: RequestContext;
}) => any;

export type AfterDeleteHook<T extends TypeWithID = any> = (args: {
  doc: T;
  req: PayloadRequest;
  id: string | number;
  context: RequestContext;
}) => any;

export type AfterErrorHook = (err: Error, res: unknown, context: RequestContext) => { response: any, status: number } | void;

export type BeforeLoginHook<T extends TypeWithID = any> = (args: {
  req: PayloadRequest;
  user: T;
  context: RequestContext;
}) => any;

export type AfterLoginHook<T extends TypeWithID = any> = (args: {
  req: PayloadRequest;
  user: T;
  token: string;
  context: RequestContext;
}) => any;

export type AfterLogoutHook<T extends TypeWithID = any> = (args: {
  req: PayloadRequest;
  res: Response;
  context: RequestContext;
}) => any;

export type AfterMeHook<T extends TypeWithID = any> = (args: {
  req: PayloadRequest;
  response: unknown;
  context: RequestContext;
}) => any;

export type AfterRefreshHook<T extends TypeWithID = any> = (args: {
  req: PayloadRequest;
  res: Response;
  token: string;
  exp: number;
  context: RequestContext;
}) => any;

export type AfterForgotPasswordHook = (args: {
  args?: any;
  context: RequestContext;
}) => any;

type BeforeDuplicateArgs<T> = {
  data: T
  locale?: string
}

export type BeforeDuplicate<T = any> = (args: BeforeDuplicateArgs<T>) => T | Promise<T>

export type CollectionAdminOptions = {
  /**
   * Exclude the collection from the admin nav and routes
   */
  hidden?: ((args: { user: User }) => boolean) | boolean;
  /**
   * Field to use as title in Edit view and first column in List view
   */
  useAsTitle?: string;
  /**
   * Default columns to show in list view
   */
  defaultColumns?: string[];
  /**
   * Additional fields to be searched via the full text search
   */
  listSearchableFields?: string[];
  hooks?: {
    /**
     * Function that allows you to modify a document's data before it is duplicated
     */
    beforeDuplicate?: BeforeDuplicate;
  }
  /**
   * Place collections into a navigational group
   * */
  group?: Record<string, string> | string;
  /**
   * Custom description for collection
   */
  description?: EntityDescription;
  disableDuplicate?: boolean;
  /**
   * Hide the API URL within the Edit view
   */
  hideAPIURL?: boolean
  /**
   * Custom admin components
   */
  components?: {
    /**
       * Components within the edit view
       */
    edit?: {
      /**
       * Replaces the "Save" button
       * + drafts must be disabled
       */
      SaveButton?: CustomSaveButtonProps
      /**
       * Replaces the "Publish" button
       * + drafts must be enabled
       */
      PublishButton?: CustomPublishButtonProps
      /**
       * Replaces the "Save Draft" button
       * + drafts must be enabled
       * + autosave must be disabled
       */
      SaveDraftButton?: CustomSaveDraftButtonProps
      /**
       * Replaces the "Preview" button
       */
      PreviewButton?: CustomPreviewButtonProps
    },
    views?: {
      Edit?: React.ComponentType<EditProps>
      List?: React.ComponentType<ListProps>
    },
    BeforeList?: React.ComponentType<ListProps>[],
    BeforeListTable?: React.ComponentType<ListProps>[],
    AfterListTable?: React.ComponentType<ListProps>[],
    AfterList?: React.ComponentType<ListProps>[],
  };
  pagination?: {
    defaultLimit?: number
    limits?: number[]
  }
  enableRichTextLink?: boolean
  enableRichTextRelationship?: boolean
  /**
   * Function to generate custom preview URL
   */
  preview?: GeneratePreviewURL
}

/** Manage all aspects of a data collection */
export type CollectionConfig = {
  slug: string;
  /**
   * Label configuration
   */
  labels?: {
    singular?: Record<string, string> | string;
    plural?: Record<string, string> | string;
  };
  /**
   * Default field to sort by in collection list view
   */
  defaultSort?: string;
  /**
   * GraphQL configuration
   */
  graphQL?: {
    singularName?: string
    pluralName?: string
  } | false
  /**
   * Options used in typescript generation
   */
  typescript?: {
    /**
     * Typescript generation name given to the interface type
     */
    interface?: string
  }
  fields: Field[];
  /**
   * Array of database indexes to create, including compound indexes that have multiple fields
   */
  indexes?: TypeOfIndex[];
  /**
   * Collection admin options
   */
  admin?: CollectionAdminOptions;
  /**
   * Hooks to modify Payload functionality
   */
  hooks?: {
    beforeOperation?: BeforeOperationHook[];
    beforeValidate?: BeforeValidateHook[];
    beforeChange?: BeforeChangeHook[];
    afterChange?: AfterChangeHook[];
    beforeRead?: BeforeReadHook[];
    afterRead?: AfterReadHook[];
    beforeDelete?: BeforeDeleteHook[];
    afterDelete?: AfterDeleteHook[];
    afterError?: AfterErrorHook;
    beforeLogin?: BeforeLoginHook[];
    afterLogin?: AfterLoginHook[];
    afterLogout?: AfterLogoutHook[];
    afterMe?: AfterMeHook[];
    afterRefresh?: AfterRefreshHook[];
    afterForgotPassword?: AfterForgotPasswordHook[];
  };
  /**
   * Custom rest api endpoints, set false to disable all rest endpoints for this collection.
   */
  endpoints?: Omit<Endpoint, 'root'>[] | false;
  /**
   * Access control
   */
  access?: {
    create?: Access;
    read?: Access;
    readVersions?: Access;
    update?: Access;
    delete?: Access;
    admin?: (args?: any) => boolean | Promise<boolean>;
    unlock?: Access;
  };
  /**
   * Collection login options
   *
   * Use `true` to enable with default options
   */
  auth?: IncomingAuthType | boolean;
  /**
   * Customize the handling of incoming file uploads
   *
   * @default false // disable uploads
   */
  upload?: IncomingUploadType | boolean;
  /**
   * Customize the handling of incoming file uploads
   *
   * @default false // disable versioning
   */
  versions?: IncomingCollectionVersions | boolean;
  /**
   * Add `createdAt` and `updatedAt` fields
   *
   * @default true
   */
  timestamps?: boolean
  /** Extension point to add your custom data. */
  custom?: Record<string, any>;
};

export interface SanitizedCollectionConfig extends Omit<DeepRequired<CollectionConfig>, 'auth' | 'upload' | 'fields' | 'versions' | 'endpoints'> {
  auth: Auth;
  upload: Upload;
  fields: Field[];
  versions: SanitizedCollectionVersions;
  endpoints: Omit<Endpoint, 'root'>[] | false;
}

export type Collection = {
  config: SanitizedCollectionConfig;
  graphQL?: {
    type: GraphQLObjectType
    paginatedType: GraphQLObjectType
    JWT: GraphQLObjectType
    versionType: GraphQLObjectType
    whereInputType: GraphQLInputObjectType
    mutationInputType: GraphQLNonNull<any>
    updateMutationInputType: GraphQLNonNull<any>
  }
};

export type BulkOperationResult<TSlug extends keyof GeneratedTypes['collections']> = {
  docs: GeneratedTypes['collections'][TSlug][],
  errors: {
    message: string
    id: GeneratedTypes['collections'][TSlug]['id']
  }[]
}

export type AuthCollection = {
  config: SanitizedCollectionConfig;
}

export type TypeWithID = {
  id: string | number
}

export type TypeWithTimestamps = {
  id: string | number
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

type IndexDirection = 1 | -1 | '2d' | '2dsphere' | 'geoHaystack' | 'hashed' | 'text' | 'ascending' | 'asc' | 'descending' | 'desc';

type IndexOptions = {
  expires?: number | string
  weights?: Record<string, number>
  /** Creates the index in the background, yielding whenever possible. */
  background?: boolean;
  /** Creates an unique index. */
  unique?: boolean;
  /** Override the autogenerated index name (useful if the resulting name is larger than 128 bytes) */
  name?: string;
  /** Creates a partial index based on the given filter object (MongoDB 3.2 or higher) */
  partialFilterExpression?: Document;
  /** Creates a sparse index. */
  sparse?: boolean;
  /** Allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher) */
  expireAfterSeconds?: number;
  /** Allows users to configure the storage engine on a per-index basis when creating an index. (MongoDB 3.0 or higher) */
  storageEngine?: Document;
  /** (MongoDB 4.4. or higher) Specifies how many data-bearing members of a replica set, including the primary, must complete the index builds successfully before the primary marks the indexes as ready. This option accepts the same values for the "w" field in a write concern plus "votingMembers", which indicates all voting data-bearing nodes. */
  commitQuorum?: number | string;
  /** Specifies the index version number, either 0 or 1. */
  version?: number;
  default_language?: string;
  language_override?: string;
  textIndexVersion?: number;
  '2dsphereIndexVersion'?: number;
  bits?: number;
  /** For geospatial indexes set the lower bound for the co-ordinates. */
  min?: number;
  /** For geospatial indexes set the high bound for the co-ordinates. */
  max?: number;
  bucketSize?: number;
  wildcardProjection?: Document;
  /** Specifies that the index should exist on the target collection but should not be used by the query planner when executing operations. (MongoDB 4.4 or higher) */
  hidden?: boolean;
}

export type TypeOfIndex = {
  fields: Record<string, IndexDirection>
  options?: IndexOptions
}

export default `
  type PageInput {
    title: String!
    content: String
    metaTitle: String
    metaDesc: String
  }

  type Page {
    id: String
    title: String
    content: String
    metaTitle: String
    metaDesc: String
    createdAt: String
    updatedAt: String
  }

  type Query {
    page(id: String!, locale: String): Page
    pages(locale: String): [Page]
  }

  type Mutation {
    createPage(input: PageInput): Page
  }
`;

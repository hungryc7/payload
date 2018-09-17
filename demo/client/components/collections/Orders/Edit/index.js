import React, { Component } from 'react';
import { connect } from 'react-redux';

import { EditView } from 'payload/components';

const mapStateToProps = state => ({
  collections: state.collections.all
});

class Edit extends Component {
  constructor(props) {
    super(props);
    this.slug = 'orders';
    this.collection = this.props.collections[this.slug];
  }

  render() {
    return (
      <EditView
        id={this.props.match.params.id}
        slug={this.slug}
        collection={this.collection}>
        <h1>Edit Order {this.props.match.params.id}</h1>
      </EditView>
    );
  }
}

export default connect(mapStateToProps)(Edit);

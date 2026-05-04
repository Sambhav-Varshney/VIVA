function presentComments(comments) {
  return comments.map(comment => ({
    id: comment._id,
    comment: comment.comment,
    user: comment.userId,
    createdAt: comment.createdAt
  }));
}

function presentPost(post, comments = []) {
  return {
    id: post._id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    author: post.userId,
    createdAt: post.createdAt,
    comments: presentComments(comments)
  };
}

function presentTrendingPost(post) {
  return {
    id: post._id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    createdAt: post.createdAt,
    commentCount: post.commentCount,
    author: post.author
  };
}

module.exports = { presentPost, presentTrendingPost };

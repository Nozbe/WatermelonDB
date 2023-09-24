// react navigation types
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Blog } from "./model/Blog.model";
import { Post } from "./model/Post.model";
import { Comment } from "./model/Comment.model";

export type RootStackParamList = {
  Root: undefined;
  Blog: { blog: Blog };
  Post: { post: Post };
  ModerationQueue: { blog: Blog };
}

export type RootProps = NativeStackScreenProps<RootStackParamList, 'Root'>
export type BlogProps = NativeStackScreenProps<RootStackParamList, 'Blog'>
export type PostProps = NativeStackScreenProps<RootStackParamList, 'Post'>
export type ModerationQueueProps = NativeStackScreenProps<RootStackParamList, 'ModerationQueue'>
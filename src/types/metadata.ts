import type { PageRef } from "./common.js";

export interface GalleryTokenResolution extends PageRef {
  token?: string;
  error?: string;
}

export interface GalleryTokenBatchResult {
  results: GalleryTokenResolution[];
  inputCount: number;
  successCount: number;
  errorCount: number;
  preservedOrder: true;
}

export interface TorrentMetadata {
  hash: string;
  added: string;
  name: string;
  tsize: string;
  fsize: string;
}

export interface GalleryMetadata {
  gid: number;
  token?: string;
  title?: string;
  title_jpn?: string;
  category?: string;
  thumb?: string;
  uploader?: string;
  posted?: string;
  filecount?: string;
  filesize?: number;
  expunged?: boolean;
  rating?: string;
  torrentcount?: string;
  torrents?: TorrentMetadata[];
  tags?: string[];
  parent_gid?: string;
  parent_key?: string;
  current_gid?: string;
  current_key?: string;
  first_gid?: string;
  first_key?: string;
  error?: string;
}

export interface GalleryMetadataBatchResult {
  galleries: GalleryMetadata[];
  inputCount: number;
  successCount: number;
  errorCount: number;
  preservedOrder: true;
}

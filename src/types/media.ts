
import { MediaType } from "@/contexts/MediaContext";

export interface MediaFile {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  url: string;
  type: MediaType;
  duration?: number;
  size?: number;
}

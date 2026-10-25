import java.awt.Font;
import java.awt.font.FontRenderContext;
import java.awt.geom.AffineTransform;
import java.awt.geom.PathIterator;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Locale;
public class MakeBanner {
 static String outline(String text, int size, float y) {
  Font f=new Font("SansSerif",Font.BOLD,size);
  var glyph=f.createGlyphVector(new FontRenderContext(new AffineTransform(),true,true),text);
  float x=(320f-(float)glyph.getVisualBounds().getWidth())/2f;
  PathIterator it=glyph.getOutline(x,y).getPathIterator(null);
  double[] c=new double[6];StringBuilder p=new StringBuilder();
  while(!it.isDone()){int t=it.currentSegment(c);String op=t==0?"M":t==1?"L":t==2?"Q":t==3?"C":"Z";p.append(op);int n=t==0||t==1?2:t==2?4:t==3?6:0;for(int i=0;i<n;i++)p.append(String.format(Locale.ROOT,"%.2f",c[i])).append(i==n-1?' ':',');it.next();}
  return p.toString();
 }
 public static void main(String[] args)throws Exception {
  String xml="<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<vector xmlns:android=\"http://schemas.android.com/apk/res/android\" android:width=\"320dp\" android:height=\"180dp\" android:viewportWidth=\"320\" android:viewportHeight=\"180\">\n";
  xml+="<path android:fillColor=\"#0A0A0B\" android:pathData=\"M0,0H320V180H0Z\"/>\n<path android:fillColor=\"#241015\" android:pathData=\"M190,0H320V180H70Z\"/>\n<path android:fillColor=\"#EF4444\" android:pathData=\"M25,42H60V47H25Z\"/>\n";
  xml+="<path android:fillColor=\"#FFFFFF\" android:pathData=\""+outline("YAMONFILM",35,100)+"\"/>\n";
  xml+="<path android:fillColor=\"#F87171\" android:pathData=\""+outline("POUR ANDROID TV",10,132)+"\"/>\n</vector>\n";
  Files.createDirectories(Paths.get(args[0]).getParent());Files.writeString(Paths.get(args[0]),xml);
 }
}

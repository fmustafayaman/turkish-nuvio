// Kullanım: nfetch <json>  json = {url, method, headers, body(base64)?}
// Çıktı: JSON {status, url, headers, body(base64)}
import Foundation
let input = try! JSONSerialization.jsonObject(with: CommandLine.arguments[1].data(using: .utf8)!) as! [String: Any]
var req = URLRequest(url: URL(string: input["url"] as! String)!)
req.httpMethod = (input["method"] as? String) ?? "GET"
req.timeoutInterval = 30
for (k, v) in (input["headers"] as? [String: String]) ?? [:] { req.setValue(v, forHTTPHeaderField: k) }
if let b = input["body"] as? String { req.httpBody = Data(base64Encoded: b) }
let cfg = URLSessionConfiguration.ephemeral
let sem = DispatchSemaphore(value: 0)
URLSession(configuration: cfg).dataTask(with: req) { d, resp, e in
  var out: [String: Any] = [:]
  if let h = resp as? HTTPURLResponse {
    out["status"] = h.statusCode; out["url"] = h.url?.absoluteString ?? ""
    var hs: [String: String] = [:]; for (k, v) in h.allHeaderFields { hs[String(describing: k).lowercased()] = String(describing: v) }
    out["headers"] = hs
  }
  if let e = e { out["error"] = e.localizedDescription }
  out["body"] = (d ?? Data()).base64EncodedString()
  FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: out))
  sem.signal()
}.resume()
sem.wait()

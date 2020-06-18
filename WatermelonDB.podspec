require "json"

package = JSON.parse(File.read("package.json"))

Pod::Spec.new do |s|
  s.name         = "WatermelonDB"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["licence"]
  s.author       = { "author" => package["author"] }
  s.platforms    = { :ios => "9.0", :tvos => "9.0" }
  s.source       = { :http => 'file:' + __dir__ + '/'  }
  s.source_files = "native/ios/**/*.{h,m,swift}"
  s.requires_arc = true
  s.dependency "React"
end

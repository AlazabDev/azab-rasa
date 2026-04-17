import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import brandLogo from "@/assets/brand-identity.png";

const Footer = () => {
  return (
    <footer role="contentinfo" className="bg-primary text-primary-foreground pt-16 pb-8">
      <div className="container-custom px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* About */}
          <div>
            <img src={brandLogo} alt="Brand Identity" className="h-12 mb-4 brightness-0 invert" />
            <p className="text-primary-foreground/70 text-sm font-body leading-relaxed mb-6">
              شركة رائدة في تجهيز المحلات التجارية منذ 2010، نفخر بتنفيذ أكثر من 200 مشروع في كبرى المولات
            </p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Linkedin, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-bold text-lg mb-4">روابط سريعة</h4>
            <ul className="space-y-2">
              {[
                { label: "عن الشركة", href: "/about" },
                { label: "خدماتنا", href: "/services" },
                { label: "مشاريعنا", href: "/projects" },
                { label: "فريق العمل", href: "/team" },
                { label: "شركاء النجاح", href: "/partners" },
                { label: "الوظائف", href: "/careers" },
                { label: "المدونة", href: "/blog" },
                { label: "سياسة الخصوصية", href: "/privacy" },
                { label: "شروط الاستخدام", href: "/terms" },
                { label: "سياسة الكوكيز", href: "/cookies" },
                { label: "حذف البيانات", href: "/data-deletion" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/60 text-sm font-body hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-lg mb-4">خدماتنا الرئيسية</h4>
            <ul className="space-y-2">
              {[
                "التعديلات والتأسيس",
                "وحدات العرض",
                "وحدات التخزين",
                "الديكور والواجهات",
                "التسليم النهائي",
              ].map((service) => (
                <li key={service}>
                  <Link
                    to="/services"
                    className="text-primary-foreground/60 text-sm font-body hover:text-accent transition-colors"
                  >
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-lg mb-4">معلومات الاتصال</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <span className="text-primary-foreground/70 text-sm font-body">الحي التجاري - مدينة الرياض</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-accent shrink-0" />
                <a href="tel:+201004006620" className="text-primary-foreground/70 text-sm font-body hover:text-accent transition-colors" dir="ltr">
                  +20 100 400 6620
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-accent shrink-0" />
                <a href="mailto:brand.identity@alazab.com" className="text-primary-foreground/70 text-sm font-body hover:text-accent transition-colors">
                  brand.identity@alazab.com
                </a>
              </li>
            </ul>

            {/* Map */}
            <div className="mt-4 rounded-lg overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2708.771324907652!2d31.278762925568998!3d29.987812974952135!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1458396627ebf27d%3A0x15bc48a54f2e9a92!2z2KfZhNi52LLYqCDZhNmE2YXZgtin2YjZhNin2Kog2YjYp9mE2KrZiNix2YrYr9in2Ko!5e1!3m2!1sar!2seg!4v1773443057660!5m2!1sar!2seg"
                width="100%"
                height="150"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="موقعنا"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-8 text-center">
          <p className="text-primary-foreground/40 text-sm font-body">
            © {new Date().getFullYear()} Brand Identity - Alazab Group. جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const CTABand = () => {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 border border-primary-foreground rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 border border-primary-foreground rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="container-custom px-4 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <h2 className="font-display font-bold text-3xl md:text-4xl text-primary-foreground mb-4">
            جاهز لتجهيز محلك في المول؟
          </h2>
          <p className="text-primary-foreground/70 text-lg font-body mb-8 max-w-xl mx-auto">
            دعنا نساعدك في تحويل مساحتك إلى تجربة بيع متكاملة
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-lg bg-accent text-accent-foreground font-display font-bold text-lg hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            تواصل معنا الآن
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTABand;

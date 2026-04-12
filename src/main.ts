import { bootstrapApplication } from '@angular/platform-browser';
import { DesignerComponent } from './app/features/designer/designer.component';

bootstrapApplication(DesignerComponent).catch((err) => console.error(err));

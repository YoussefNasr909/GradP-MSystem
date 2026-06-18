const fs = require('fs');
const filePath = 'd:\\FCI\\Projects\\FULL STACK\\Graduation Project\\demo\\GraduationProjectFrontend\\app\\dashboard\\reviews\\page.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// We want to replace lines 965 to 1035 (0-indexed) with the <ReviewForm /> component.
// Lines 966 to 1036 are 1-indexed. Let's double check by printing the lines.
const startIndex = 965; // line 966
const endIndex = 1036;  // line 1037
lines.splice(startIndex, endIndex - startIndex, 
  '                {/* Right side: Review Form (Sticky Actions) */}',
  '                <ReviewForm',
  '                  key={selectedTask.id}',
  '                  selectedTask={selectedTask}',
  '                  submittingReview={submittingReview}',
  '                  onApprove={handleApprove}',
  '                  onReject={handleReject}',
  '                />'
);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Replaced lines successfully.');

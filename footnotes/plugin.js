/**
 * Basic sample plugin inserting footnotes elements into CKEditor editing area.
 *
 * Created out of the CKEditor Plugin SDK:
 * http://docs.ckeditor.com/#!/guide/plugin_sdk_sample_1
 */

// Register the plugin within the editor.
CKEDITOR.plugins.add( 'footnotes', {
	
    editor: false,  
    footnote_ids: [],    
    requires: 'widget',
	icons: 'footnotes',
    

	// The plugin initialization logic goes inside this method.
	init: function(editor) {
        this.editor = editor;
        
        // Allow `cite` to be editable:
        CKEDITOR.dtd.$editable['cite'] = 1;
        
        // Add some CSS tweaks:
        var css = '.footnotes{background:#eee; padding:1px 15px;} .footnotes cite{font-style: normal;}';
        CKEDITOR.addCss(css);
        
        // Add the reorder change event:
        var $this = this;
        editor.on('change', function(evt)  {
            // Don't reorder the markers if editing a cite:
            var footnote_section = evt.editor.getSelection().getStartElement().getAscendant('section');
            if (footnote_section && footnote_section.$.id == 'footnotes') {
                return;
            }
            // SetTimeout seems to be necessary (it's used in the core but can't be 100% sure why)
            setTimeout(function(){
                    $this.reorderMarkers();
                },
                0
            );
        });
        
        // Build the initial footnotes widget editables definition:
        var def = {
            header: {
                selector: 'header > *',
                //allowedContent: ''
                allowedContent: 'i b span sub sup;'
            }
        };
        var contents = jQuery('<div>' + editor.element.$.textContent + '</div>')
                 , l = contents.find('#footnotes li').length
                 , i = 1;
        for (i; i <= l; i++) {
            def['footnote_' + i] = {selector: '#footnote-' + i +' cite', allowedContent: 'a[href]; cite[*](*); b i span'};
        }
    
        // Register the footnotes widget.
		editor.widgets.add('footnotes', {
        
			// Minimum HTML which is required by this widget to work.
			requiredContent: 'section(footnotes)',

			// Check the elements that need to be converted to widgets.
			upcast: function(element) {
				return element.name == 'section' && element.hasClass('footnotes');
			},
            
            editables: def
		});
		
		// Register the footnotemarker widget.
		editor.widgets.add('footnotemarker', {

			// Minimum HTML which is required by this widget to work.
			requiredContent: 'sup[data-footnote-id]',

			// Check the elements that need to be converted to widgets.
			upcast: function(element) {
				return element.name == 'sup' && element.attributes['data-footnote-id'] != 'undefined';
			},
		});

		// Define an editor command that opens our dialog.
		editor.addCommand('footnotes', new CKEDITOR.dialogCommand('footnotesDialog', {
            // @TODO: This needs work:
            allowedContent: 'section[*](*);header[*](*);li[*];a[*];cite(*)[*];sup[*]',
			requiredContent: 'section[*](*);header[*](*);li[*];a[*];cite(*)[*];sup[*]'
		}));

		// Create a toolbar button that executes the above command.
		editor.ui.addButton('Footnotes', {

			// The text part of the button (if available) and tooptip.
			label: 'Insert Footnotes',

			// The command to execute on click.
			command: 'footnotes',

			// The button placement in the toolbar (toolbar group name).
			toolbar: 'insert'
		});

		// Register our dialog file. this.path is the plugin folder path.
		CKEDITOR.dialog.add('footnotesDialog', this.path + 'dialogs/footnotes.js');
	},
    

    build: function(footnote, is_new) {
        this.editor.fire('lockSnapshot');
        if (is_new) {
            // Generate new id:
            footnote_id = this.generateFootnoteId();
        } else {
            // Existing footnote id passed:
            footnote_id = footnote;
        }

        // Insert the marker:
        var footnote_marker = '<sup data-footnote-id="' + footnote_id + '">X</sup>';

        this.editor.fire('unlockSnapshot');
        this.editor.insertHtml(footnote_marker);
        
        if (is_new) {
            this.addFootnote(this.buildFootnote(footnote_id, footnote));
        }

        this.reorderMarkers();
    },
    
    buildFootnote: function(footnote_id, footnote_text, data) {
        data ? data : false;
        var links   = '';
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        var order   = data ? data.order.indexOf(footnote_id) + 1
                           : 1;
        if (data && data.occurrences[footnote_id] == 1) {
            links = '<a href="#footnote-marker-' + order + '-1">^</a> ';
        } else if (data && data.occurrences[footnote_id] > 1) {
            var i = 0
              , l = data.occurrences[footnote_id]
              , n = l;
            for (i; i < l; i++) {
                links += '<a href="#footnote-marker-' + order + '-' + (i + 1) + '">' + letters.charAt(i) + '</a>';
                if (i < l-1) {
                    links += ', ';
                } else {
                    links += ' ';
                }
            }
        }
        footnote = '<li id="footnote-' + order + '" data-footnote-id="' + footnote_id + '">' + links + '<cite>' + footnote_text + '</cite></li>';
        return footnote;
    },
    
    addFootnote: function(footnote) {
        $contents  = jQuery('#' + this.editor.id + '_contents iframe').contents().find('body');
        $footnotes = $contents.find('#footnotes');
        
        if ($footnotes.length == 0) {
            var container = '<section id="footnotes" class="footnotes"><header><h2>Footnotes</h2></header><ol>' + footnote + '</ol></section>';
            // Move cursor to end of content:
            var range = this.editor.createRange();
            range.moveToElementEditEnd(range.root);
            this.editor.getSelection().selectRanges([range]);
            // Insert the container:
            this.editor.insertHtml(container);
        } else {
            $footnotes.find('ol').append(footnote);
        }
        return;
    },
    
    generateFootnoteId: function() {
        var id = Math.random().toString(36).substr(2, 5);
        while (jQuery.inArray(id, this.footnote_ids) != -1) {
            id = String(this.generateFootnoteId());
        }
        this.footnote_ids.push(id);
        return id;
    },
    
    reorderMarkers: function() {
        this.editor.fire('lockSnapshot');
        editor    = this.editor;
        $contents = jQuery('#' + editor.id + '_contents iframe').contents().find('body');
        var data = {
            order: [],
            occurrences: {}
        };
        
        // Find all the markers in the document:
        var $markers = $contents.find('sup[data-footnote-id]');
        // If there aren't any, remove the Footnotes container:
        if ($markers.length == 0) {
            $contents.find('#footnotes').remove();
            return;
        }
        
        // Otherwise reorder the markers:
        $markers.each(function(){
            var footnote_id = jQuery(this).attr('data-footnote-id')
              , marker_ref
              , n = data.order.indexOf(footnote_id);
            
            // If this is the markers first occurrence:
            if (n == -1) {
                // Store the id:
                data.order.push(footnote_id);
                n = data.order.length;
                data.occurrences[footnote_id] = 1;
                marker_ref = n + '-1';
            } else {
                // Otherwise increment the number of occurrences:
                // (increment n due to zero-index array)
                n++;
                data.occurrences[footnote_id]++;
                marker_ref = n + '-' + data.occurrences[footnote_id];
            }
            // Replace the marker contents:
            var marker = '<a href="#footnote-' + n + '" id="footnote-marker-' + marker_ref + '" rel="footnote">[' + n + ']</a>';
            jQuery(this).html(marker);
        });
        
        // Then rebuild the Footnotes content to match marker order:
        var footnotes     = '';
        var footnote_text = '';
        for (i in data.order) {
            footnote_id   = data.order[i];
            footnote_text = $contents.find('#footnotes [data-footnote-id=' + footnote_id + '] cite').html();
            footnotes    += this.buildFootnote(footnote_id, footnote_text, data);
        }
        $contents.find('#footnotes ol').html(footnotes);
        
        // Next we need to reinstate the 'editable' properties of the footnotes.
        // (we have to do this individually due to Widgets 'fireOnce' for editable selectors)
        var el = $contents.find('#footnotes')
          , footnote_widget;
        // So first we need to find the right Widget instance:
        // (I hope there's a better way of doing this but I can't find one)
        for (i in this.editor.widgets.instances) {
            if (this.editor.widgets.instances[i].name == 'footnotes') {
                footnote_widget = this.editor.widgets.instances[i];
                break;
            }
        }
        // Then we `initEditable` each footnote, giving it a unique selector:
        for (i in data.order) {
            n = parseInt(i) + 1;
            footnote_widget.initEditable('footnote_' + n, {selector: '#footnote-' + n +' cite', allowedContent: 'a[href]; cite[*](*); b i span'});
        }

        this.editor.fire('unlockSnapshot');
        return;
    }
});
